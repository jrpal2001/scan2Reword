import mongoose from "mongoose";
import { type } from "os";
// import { type } from "os";

const notificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
    link: {
      type: String,
      required: false,
      default: ""
    },
    img: {
      type: String,
      required: false,
      default: ""
    },
    NotificationTime: {
      type: Date,
      default: Date.now(),
      // required: true,
    },
    // sent: {
    //   type: Boolean,
    //   default: false,
    // },
    groupName: {
      type: String,
      required: false,
    },
    user: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: [],
      },
    ],
  },
  {
    timestamps: true,
  }
);

const Notification =
  mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);

export default Notification;

