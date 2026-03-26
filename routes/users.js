var express = require("express");
var router = express.Router();
let { validatedResult, CreateUserValidator, ModifyUserValidator } = require("../utils/validator")
let userModel = require("../schemas/users");
let userController = require("../controllers/users");
const { checkLogin,checkRole } = require("../utils/authHandler");
let { uploadExcel } = require('../utils/uploadHandler')
let excelJs = require('exceljs')
let path = require('path')
let crypto = require('crypto')
let { sendImportPasswordMail } = require('../utils/mailHandler')

function parseCellValue(cellValue) {
  if (cellValue === null || cellValue === undefined) {
    return "";
  }
  if (typeof cellValue === "object") {
    if (cellValue.text) return String(cellValue.text).trim();
    if (cellValue.hyperlink) return String(cellValue.hyperlink).trim();
    if (Array.isArray(cellValue.richText)) {
      return cellValue.richText.map(function (part) {
        return part.text || "";
      }).join("").trim();
    }
  }
  return String(cellValue).trim();
}

function generateRandomPassword(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  const bytes = crypto.randomBytes(length);
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}

function isValidEmail(email) {
  return /^\S+@\S+\.\S+$/.test(email);
}


router.get("/", checkLogin,checkRole("ADMIN","MODERATOR"), async function (req, res, next) {
  let users = await userModel
    .find({ isDeleted: false })
  res.send(users);
});

router.get("/:id", async function (req, res, next) {
  try {
    let result = await userModel
      .find({ _id: req.params.id, isDeleted: false })
    if (result.length > 0) {
      res.send(result);
    }
    else {
      res.status(404).send({ message: "id not found" });
    }
  } catch (error) {
    res.status(404).send({ message: "id not found" });
  }
});

router.post("/", CreateUserValidator, validatedResult, async function (req, res, next) {
  try {
    let newUser = await userController.CreateAnUser(
      req.body.username, req.body.password, req.body.email,
      req.body.role, req.body.fullname, req.body.avatarUrl
    )
    res.send(newUser);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.post('/import', checkLogin, uploadExcel.fields([
  { name: 'file', maxCount: 1 },
  { name: 'files', maxCount: 1 },
  { name: 'excel', maxCount: 1 }
]), async function (req, res, next) {
  let uploadFile = null;
  if (req.files) {
    if (req.files.file && req.files.file[0]) uploadFile = req.files.file[0];
    if (!uploadFile && req.files.files && req.files.files[0]) uploadFile = req.files.files[0];
    if (!uploadFile && req.files.excel && req.files.excel[0]) uploadFile = req.files.excel[0];
  }

  if (!uploadFile) {
    return res.status(400).send({ message: 'vui long gui file excel' });
  }

  let workBook = new excelJs.Workbook();
  let pathFile = path.join(__dirname, '../uploads', uploadFile.filename);
  await workBook.xlsx.readFile(pathFile);
  let worksheet = workBook.worksheets[0];

  if (!worksheet) {
    return res.status(400).send({ message: 'file excel khong hop le' });
  }

  let existedUsers = await userModel.find({ isDeleted: false }).select('username email');
  let usernameSet = new Set(existedUsers.map(function (u) { return String(u.username).toLowerCase(); }));
  let emailSet = new Set(existedUsers.map(function (u) { return String(u.email).toLowerCase(); }));

  let results = [];
  for (let index = 2; index <= worksheet.rowCount; index++) {
    let row = worksheet.getRow(index);
    let username = parseCellValue(row.getCell(1).value);
    let email = parseCellValue(row.getCell(2).value).toLowerCase();
    let rowErrors = [];

    if (!username) rowErrors.push('username khong duoc de trong');
    if (!email) rowErrors.push('email khong duoc de trong');
    if (email && !isValidEmail(email)) rowErrors.push('email sai dinh dang');

    let keyUsername = username.toLowerCase();
    if (keyUsername && usernameSet.has(keyUsername)) {
      rowErrors.push('username da ton tai');
    }
    if (email && emailSet.has(email)) {
      rowErrors.push('email da ton tai');
    }

    if (rowErrors.length > 0) {
      results.push({
        row: index,
        success: false,
        username: username,
        email: email,
        errors: rowErrors
      });
      continue;
    }

    let password = generateRandomPassword(16);

    try {
      let newUser = new userModel({
        username: username,
        email: email,
        password: password
      });
      await newUser.save();

      usernameSet.add(keyUsername);
      emailSet.add(email);

      let isMailSent = true;
      let mailError = null;
      try {
        await sendImportPasswordMail(email, username, password);
      } catch (error) {
        isMailSent = false;
        mailError = error.message;
      }

      results.push({
        row: index,
        success: true,
        username: username,
        email: email,
        mailSent: isMailSent,
        mailError: mailError
      });
    } catch (error) {
      results.push({
        row: index,
        success: false,
        username: username,
        email: email,
        errors: [error.message]
      });
    }
  }

  res.send({
    totalRows: Math.max(worksheet.rowCount - 1, 0),
    successCount: results.filter(function (r) { return r.success; }).length,
    failCount: results.filter(function (r) { return !r.success; }).length,
    results: results
  });
});

router.put("/:id", ModifyUserValidator, validatedResult, async function (req, res, next) {
  try {
    let id = req.params.id;
    let updatedItem = await userModel.findByIdAndUpdate(id, req.body, { new: true });

    if (!updatedItem) return res.status(404).send({ message: "id not found" });

    let populated = await userModel
      .findById(updatedItem._id)
    res.send(populated);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.delete("/:id", async function (req, res, next) {
  try {
    let id = req.params.id;
    let updatedItem = await userModel.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true }
    );
    if (!updatedItem) {
      return res.status(404).send({ message: "id not found" });
    }
    res.send(updatedItem);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

module.exports = router;