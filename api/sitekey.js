export default function handler(_req, res) {
  res.status(200).json({ sitekey: process.env.HCAPTCHA_SITEKEY || "" });
}
