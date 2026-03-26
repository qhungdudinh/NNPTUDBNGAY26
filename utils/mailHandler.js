const nodemailer = require("nodemailer");


const transporter = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 25,
    secure: false, // Use true for port 465, false for port 587
    auth: {
        user: "",
        pass: "",
    },
});
module.exports = {
    sendMail: async function (to,url) {
        const info = await transporter.sendMail({
            from: 'hehehe@gmail.com',
            to: to,
            subject: "reset password URL",
            text: "click vao day de doi pass", // Plain-text version of the message
            html: "click vao <a href="+url+">day</a> de doi pass", // HTML version of the message
        });

        console.log("Message sent:", info.messageId);
    },
    sendImportPasswordMail: async function (to, username, password) {
        const info = await transporter.sendMail({
            from: 'hehehe@gmail.com',
            to: to,
            subject: 'Tai khoan moi cua ban',
            text: `Xin chao ${username}, mat khau tam thoi cua ban la: ${password}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                    <img src="https://mailtrap.io/wp-content/uploads/2021/04/mailtrap-new-logo.svg" alt="Mailtrap" style="height: 32px; margin-bottom: 16px;" />
                    <h2 style="margin: 0 0 12px; color: #111827;">Tai khoan da duoc tao</h2>
                    <p style="margin: 0 0 8px; color: #374151;">Xin chao <strong>${username}</strong>,</p>
                    <p style="margin: 0 0 12px; color: #374151;">He thong da tao tai khoan moi cho ban. Vui long dang nhap va doi mat khau ngay sau lan dau tien.</p>
                    <div style="background: #f3f4f6; border-radius: 6px; padding: 12px; margin-bottom: 12px;">
                        <p style="margin: 0 0 6px; color: #111827;"><strong>Username:</strong> ${username}</p>
                        <p style="margin: 0; color: #111827;"><strong>Mat khau tam thoi:</strong> ${password}</p>
                    </div>
                    <p style="margin: 0; color: #6b7280; font-size: 12px;">Email tu dong, vui long khong tra loi.</p>
                </div>
            `,
        });

        console.log("Message sent:", info.messageId);
    }
}
