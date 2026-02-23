import { notificationController } from "../controllers/notification.controller.js";
import { verifyJWT } from "../middlewares/AdminauthMiddlewares.js";
import express from "express";

const router = express.Router();

router.post("/all", notificationController.sendNotificationToAll);
router.post("/", notificationController.sendNotificationToUsers);
router.get("/", notificationController.getNotifications);
router.get("/my", verifyJWT, notificationController.getMyNotifications); // Protected route for mobile app
router.delete("/my", verifyJWT, notificationController.deleteMyNotification); // Delete user's notifications by ID
router.post("/subscribeToken", notificationController.saveAndSubscribeToken);

export default router;