import express from "express";
import { query } from "../db.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const result = await query(
      `SELECT *
       FROM app_notifications
       WHERE user_id = $1
       ORDER BY is_read ASC, created_at DESC, id DESC
       LIMIT 50`,
      [req.user.id]
    );

    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ message: "Unable to fetch notifications", error: error.message });
  }
});

router.put("/:id/read", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query(
      `UPDATE app_notifications
       SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Notification not found" });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: "Unable to update notification", error: error.message });
  }
});

export default router;
