/**
 * Public catalog boundary: FieldRadar has no server-verified user identity or
 * spend quota store. A configured provider key is not authorization to spend it.
 * Keep hosted AI unavailable until an authenticated, bounded product flow exists.
 * The frontend's explicitly configured BYOK flow remains separate.
 */
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Allow", "POST");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  return res.status(503).json({
    code: "HOSTED_AI_UNAVAILABLE",
    error: "Hosted AI scouting is unavailable. Connect your own provider in Model Link.",
  });
}
