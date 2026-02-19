import { s3Client } from "./s3-credentials.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { config } from "../../config/index.js";

// export const putObject = async (file, fileName) => {
//   try {
//     if (!file || !file.data) {
//       throw new Error("File data is missing or empty");
//     }
//     console.log("bucket", process.env.AWS_S3_BUCKET);

//     const params = {
//       Bucket: process.env.AWS_S3_BUCKET,
//       Key: fileName,
//       Body: file.data, // Directly use the file buffer
//       ContentType: file.mimetype || "application/octet-stream", // Ensure ContentType is valid
//     };

//     console.log("Uploading file with params:", params);

//     const command = new PutObjectCommand(params);
//     const data = await s3Client.send(command);

//     if (data.$metadata.httpStatusCode !== 200) {
//       throw new Error("Failed to upload file to S3");
//     }

//     const url = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${params.Key}`;
//     console.log("Uploaded file URL:", url);

//     return { url, key: params.Key };
//   } catch (err) {
//     console.error("Error uploading file to S3:", err);
//     throw err;
//   }
// };

export const putObject = async (file, fileName) => {
  console.log("🚀 ~ putObject ~ file, fileName:", file, fileName)
  try {
    // Handle both multer file and wrapped file
    const fileData = file.data || file.buffer;
    const contentType = file.mimetype || "application/octet-stream";

    if (!fileData) {
      throw new Error("File data is missing or empty");
    }

    if (!config.aws.s3Bucket) {
      throw new Error("AWS_S3_BUCKET is not set in .env");
    }

    const params = {
      Bucket: config.aws.s3Bucket,
      Key: fileName,
      Body: fileData,
      ContentType: contentType,
    };

    const command = new PutObjectCommand(params);
    const data = await s3Client.send(command);

    if (data.$metadata.httpStatusCode !== 200) {
      throw new Error("Failed to upload file to S3");
    }

    const url = `https://${config.aws.s3Bucket}.s3.${config.aws.region}.amazonaws.com/${params.Key}`;

    return { url, key: params.Key };
  } catch (err) {
    console.error("Error uploading file to S3:", err);
    throw err;
  }
};