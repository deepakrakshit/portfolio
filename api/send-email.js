const nodemailer = require('nodemailer');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { name, company, email, message } = req.body || {};

    const smtpUser = process.env.FOLIO_EMAIL || process.env.SMTP_USER;
    const smtpPass = process.env.FOLIO_PASSWORD || process.env.SMTP_PASS;
    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const receiverEmail = process.env.CONTACT_RECEIVER || 'deepakrakshit505@gmail.com';

    if (!smtpUser || !smtpPass) {
        console.warn('Contact form submission received, but SMTP credentials are not configured.');
        console.log({ from: name, company, email, message });
        return res.json({ message: 'success (logged)' });
    }

    try {
        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            auth: {
                user: smtpUser,
                pass: smtpPass,
            },
        });

        await transporter.verify();
        const info = await transporter.sendMail({
            from: `"${name}" <${smtpUser}>`,
            to: receiverEmail,
            replyTo: email,
            subject: `${name} <${email}> ${company ? `from ${company}` : ''} submitted a contact form`,
            text: `${message}`,
        });

        console.log({ info });
        return res.json({ message: 'success' });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: e.message || 'Error sending email' });
    }
};
