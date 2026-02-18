import moment from "moment-timezone";
import { asyncHandler } from "../utils/asyncHandler.js";
import Notification from "./notification.model.js";
import admin from "./firebase.js";
import { User } from "../models/users/User.model.js";

// Constants
const IST_TIMEZONE = 'Asia/Kolkata';
const SUPPORTED_DATE_FORMATS = [
  moment.ISO_8601,
  'YYYY-MM-DD HH:mm',
  'YYYY-MM-DDTHH:mm'
];

function createNotificationMessageToAll(title, body) {
  return {
    topic: "all", // Send to all subscribed to this topic
    notification: { title, body },
    android: { priority: 'high' },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          'content-available': 1
        }
      }
    },
    webpush: {
      notification: { title, body, icon: 'icon.png' },
      fcm_options: { link: 'https://yourwebsite.com' }
    }
  };
}
// Utility function to convert date-time to IST
function convertDateTimeFormat(input) {
  try {
    const date = moment(input, SUPPORTED_DATE_FORMATS, true);
    if (!date.isValid()) {
      throw new Error('Invalid date format');
    }
    const dateIST = date.tz(IST_TIMEZONE);
    console.log('Converted date-time:', { input, formatted: dateIST.format() });
    return dateIST.toDate();
  } catch (error) {
    console.error('Error parsing date-time:', error.message);
    return moment().tz(IST_TIMEZONE).toDate(); // Fallback to current IST time
  }
}
// Common notification message structure
function createNotificationMessage(title, body) {
  return {
    notification: { title, body },
    android: { priority: 'high' },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          'content-available': 1
        }
      }
    },
    webpush: {
      notification: { title, body, icon: 'icon.png' },
      fcm_options: { link: 'https://yourwebsite.com' }
    }
  };
}

async function scheduleNotificationWithCron(scheduleDate, message, tokens, notificationId) {
  console.log(scheduleDate, "scheduleDate")
  console.log(message, "message")
  console.log(tokens, "tokens")
  console.log(notificationId, "notificationId")
  try {
    // const dateIST = moment.tz(scheduleDate, moment.ISO_8601, "Asia/Kolkata");
    const dateIST = moment.tz(scheduleDate, "YYYY-MM-DDTHH:mm", "Asia/Kolkata");
    const nowIST = moment().tz("Asia/Kolkata");

    if (dateIST.isBefore(nowIST.add(5, "seconds"))) {
      console.log("Scheduled time is in the past, notification not scheduled");
      return;
    }
    const scheduleNotefication = scheduleJob(dateIST.toDate(), async () => {

      const results = [];
      const errors = [];

      for (const token of tokens) {
        try {
          const response = await admin.messaging().send({ ...message, token });
          results.push({ token, success: true, response });
          await User.findOneAndUpdate(
            { token },
            { $inc: { count: 1 } },
            { upsert: true }
          );
        } catch (error) {
          errors.push({ token, error: error.message });
        }
      }
      console.log("👍");

      await Notification.findByIdAndUpdate(notificationId, { sent: true });
      // console.log("Notification results:", { results, errors });
    });
    await Notification.findByIdAndUpdate(notificationId, { NotificationName: scheduleNotefication.name });
    //     console.log("----------------");
    //     console.log("🚀 ~ scheduleNotefication ~ scheduleNotefication:", scheduleNotefication.name)

    //     console.log(scheduledJobs,"==========scheduledJobs");

    // console.log("----------------");
  } catch (error) {
    console.error("Failed to schedule notification:", error.message);
  }
}
// Send immediate notification
async function scheduleNotificationWithoutCron(message, tokens, notificationId) {
  const results = [];
  const errors = [];
  console.log("👍");

  try {
    for (const token of tokens) {
      try {
        const response = await admin.messaging().send({ ...message, token });
        results.push({ token, success: true, response });
        console.log(`Notification sent to ${token}`);

        await User.findOneAndUpdate(
          { token },
          { $inc: { count: 1 } },
          { upsert: true }
        );
      } catch (error) {
        errors.push({ token, error: error.message });
        // console.error(`Failed to send to ${token}:`, error.message);
      }
    }

    if (notificationId) {
      await Notification.findByIdAndUpdate(notificationId, { sent: true });
    }
  } catch (error) {
    console.error('Failed to send notification:', error.message);
    errors.push({ error: error.message });
  }

  return { results, errors };
}

const getNotifications = asyncHandler(async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      groupName = "",
    } = req.query;

    const query = {};

    // Search filter
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { body: { $regex: search, $options: "i" } },
      ];
    }

    // Group filter
    if (groupName) {
      query.groupName = groupName;
    }

    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 }) // latest first
        .skip(skip)
        .limit(Number(limit)),

      Notification.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      message: "Notifications fetched successfully",
      data: notifications,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch notifications",
    });
  }
});

/**
 * 📱 Get notifications for the logged-in user (Mobile App)
 * Fetches notifications targeted to the authenticated user based on their token
 * Works for all roles: Owner, Manager, Tenant
 * Supports pagination with page and limit query parameters
 */
const getMyNotifications = asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.userType || req.user.role;
    const {
      page = 1,
      limit = 10,
    } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Math.min(100, Number(limit))); // Cap limit at 100
    const skip = (pageNum - 1) * limitNum;

    // Query notifications where user array contains the logged-in user's ID
    // Using $in explicitly to match any notification where user array contains this userId
    const query = { user: { $in: [userId] } };

    console.log(`📱 Fetching notifications for ${userRole} (${userId})`);

    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 }) // latest first
        .skip(skip)
        .limit(limitNum)
        .select("title body link img NotificationTime groupName createdAt")
        .lean(),

      Notification.countDocuments(query),
    ]);

    console.log(`📱 Found ${total} notifications for user ${userId}`);

    return res.status(200).json({
      success: true,
      message: "Notifications fetched successfully",
      data: notifications,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        hasNextPage: pageNum * limitNum < total,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching user notifications:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch notifications",
    });
  }
});

/**
 * 🗑️ Delete notification(s) by ID for the logged-in user
 * Supports single ID or array of IDs
 * Only deletes notifications that belong to the authenticated user
 */
const deleteMyNotification = asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id;
    const { notificationId, notificationIds } = req.body;

    // Support both single ID and array of IDs
    let idsToDelete = [];
    if (notificationIds && Array.isArray(notificationIds)) {
      idsToDelete = notificationIds;
    } else if (notificationId) {
      idsToDelete = [notificationId];
    }

    if (idsToDelete.length === 0) {
      return res.status(400).json({
        success: false,
        message: "notificationId or notificationIds is required",
      });
    }

    // Delete only notifications that belong to this user
    // 🛠️ FIX: Don't hard delete the document, just remove the user from the 'user' array
    // This allows the notification to persist for other users if it was a broadcast
    const result = await Notification.updateMany(
      {
        _id: { $in: idsToDelete },
        user: userId, // Ensure user is actually in the array before pulling
      },
      {
        $pull: { user: userId }
      }
    );

    console.log(`🗑️ Removed notification(s) for user ${userId}. Modified count: ${result.modifiedCount}`);

    return res.status(200).json({
      success: true,
      message: `${result.modifiedCount} notification(s) deleted successfully`,
      deletedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("❌ Error deleting notification:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete notification",
    });
  }
});


const saveAndSubscribeToken = asyncHandler(async (req, res) => {
  const { token } = req.body;
  console.log("🚀 Token received:", token);

  if (!token || typeof token !== "string") {
    return res.status(400).json({ message: "Valid device token is required." });
  }

  try {
    // ✅ Subscribe token to a topic "all"
    const response = await admin.messaging().subscribeToTopic(token, "all");

    if (response.failureCount > 0) {
      return res.status(400).json({
        message: "Failed to subscribe token",
        error: response.errors[0].error,
      });
    }


    return res.status(200).json({
      message: "Token subscribed to 'all' topic successfully",
      firebaseResponse: response,
    });
  } catch (error) {
    console.error("🔥 Subscription Error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});
export const sendNotificationToUsers = asyncHandler(async (req, res) => {
  try {
    const { userIds, title, body } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: "userIds must be a non-empty array" });
    }

    if (!title || !body) {
      return res.status(400).json({ message: "Title and body are required" });
    }

    // 1️⃣ Fetch all users
    const users = await User.find({ _id: { $in: userIds } });

    if (users.length === 0) {
      return res.status(404).json({ message: "No users found for the given IDs" });
    }

    // 📱 Save SEPARATE notification to DB for each user (user-specific deletion)
    try {
      const notificationDocs = users.map(user => ({
        title,
        body,
        user: [user._id],  // Single user per notification
        groupName: "ADMIN_BROADCAST",
        NotificationTime: new Date(),
      }));
      await Notification.insertMany(notificationDocs);
      console.log(`📱 Admin: Created ${notificationDocs.length} separate notification(s) in DB`);
    } catch (dbError) {
      console.error("⚠️ Failed to save admin notification to DB:", dbError.message);
    }

    const results = [];

    // 2️⃣ Extract FCM tokens and send notification
    for (const user of users) {
      if (!user.FcmTokens || user.FcmTokens.length === 0) {
        results.push({
          userId: user._id,
          name: user.fullName,
          status: "no-token",
          message: "User has no FCM tokens",
        });
        continue;
      }

      // Send notification to each token of this user
      for (const token of user.FcmTokens) {
        const message = {
          notification: { title, body },
          token,
        };

        try {
          const response = await admin.messaging().send(message);
          results.push({
            userId: user._id,
            name: user.fullName,
            token,
            status: "success",
            response,
          });
        } catch (error) {
          results.push({
            userId: user._id,
            name: user.fullName,
            token,
            status: "failed",
            error: error.message,
          });
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: "Notifications processed",
      results,
    });

  } catch (error) {
    console.error("🔥 Error sending notifications:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export const sendNotificationToAll = asyncHandler(async (req, res) => {
  try {
    const { title, body, link, img } = req.body;

    const message = {
      topic: "all",

      // (Android + iOS use this)
      notification: {
        title,
        body,
        image: img || undefined,
      },

      // (WEB PUSH uses THIS ONLY)
      webpush: {
        headers: {
          TTL: "4500",
        },

        notification: {
          title,
          body,
          icon: img || "/icon.png",
          image: img || undefined,
          click_action: link || "/", // <-- CRITICAL FOR WEB PUSH POPUP
        },

        fcm_options: {
          link: link || "https://yourwebsite.com", // IMPORTANT
        },
      },

      android: {
        priority: "high",
      },

      apns: {
        payload: {
          aps: {
            sound: "default",
          },
        },
      },

      data: {
        link: link || "",
      },
    };

    console.log("🚀 message:", message);

    const firebaseResponse = await admin.messaging().send(message);
    console.log("🚀 firebaseResponse:", firebaseResponse);

    // 📱 Save SEPARATE notification to DB for each user with FCM tokens (user-specific deletion)
    try {
      const usersWithTokens = await User.find({
        FcmTokens: { $exists: true, $ne: [] }
      }).select("_id").lean();

      if (usersWithTokens.length > 0) {
        const notificationDocs = usersWithTokens.map(user => ({
          title,
          body,
          link: link || "",
          img: img || "",
          user: [user._id],  // Single user per notification
          groupName: "ADMIN_BROADCAST",
          NotificationTime: new Date(),
        }));
        await Notification.insertMany(notificationDocs);
        console.log(`📱 Admin Broadcast: Created ${notificationDocs.length} separate notification(s) in DB`);
      }
    } catch (dbError) {
      console.error("⚠️ Failed to save broadcast notification to DB:", dbError.message);
    }

    return res.status(200).json({
      success: true,
      message: "Notification sent to topic 'all'",
      firebaseResponse,
    });

  } catch (error) {
    console.error("Error sending FCM:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});



export const notificationController = {
  sendNotificationToAll,
  sendNotificationToUsers,
  getNotifications,
  getMyNotifications,
  deleteMyNotification,
  saveAndSubscribeToken,
};