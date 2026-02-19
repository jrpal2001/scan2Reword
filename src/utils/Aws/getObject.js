import { s3Client } from "./s3-credentials.js";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "../../config/index.js";

export const getObject = async (key) => {
    try {
        const params = {
            Bucket: config.aws.s3Bucket,
            Key: key
        }
        const command = new GetObjectCommand(params);
        const data = await s3Client.send(command);
        const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        console.log(data);
        return url;

    } catch (err) {
        console.error(err);
    }
}