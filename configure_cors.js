import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

const s3 = new S3Client({
    region: process.env.REGION,
    credentials: {
        accessKeyId: process.env.ACCESS_KEY,
        secretAccessKey: process.env.SECRET_ACCESS_KEY,
    },
});

const run = async () => {
    try {
        console.log("Configuring CORS for bucket:", process.env.BUCKET_NAME);
        const command = new PutBucketCorsCommand({
            Bucket: process.env.BUCKET_NAME,
            CORSConfiguration: {
                CORSRules: [
                    {
                        AllowedHeaders: ["*"],
                        AllowedMethods: ["PUT", "POST", "GET", "HEAD"],
                        AllowedOrigins: ["*"], // For development. In prod, lock this down.
                        ExposeHeaders: ["ETag"],
                        MaxAgeSeconds: 3000
                    }
                ]
            }
        });

        await s3.send(command);
        console.log("Successfully configured S3 CORS.");
    } catch (err) {
        console.error("Error connecting to S3 or permissions issue:", err);
    }
}

run();
