// const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
import { s3Client } from "./s3-credentials.js";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { config } from "../../config/index.js";

export const deleteObject = async (key) => {
  try {
    console.log("key", key);
    const params = {
      Bucket: config.aws.s3Bucket,
      Key: key,
    };
    const command = new DeleteObjectCommand(params);
    const data = await s3Client.send(command);

    if (data.$metadata.httpStatusCode !== 204) {
      return { status: 400, data };
    }
    return { status: 204 };
  } catch (err) {
    console.error(err);
  }
};