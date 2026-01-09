import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import model from "../schema/locker.js";
import dotenv from "dotenv";
import { s3 } from "../config/aws.js";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { decryptObjectValues } from "../config/utils.js";

dotenv.config();

const encryptName = (bytes = 32) => crypto.randomBytes(bytes).toString("hex");

// Phase 1: Generate Signed URL
const initUpload = async (req, res) => {
  try {
    const { name, passkey, fileName, fileType } = decryptObjectValues(req.body);
    console.log(`[initUpload] Request for Locker: ${name}, File: ${fileName}`);

    const locker = await model.findOne({ name });

    if (!locker) return res.status(400).json({ message: "Locker doesn't exist" });

    const match = await bcrypt.compare(String(passkey), locker.passkey);
    if (!match) return res.status(400).json({ message: "Incorrect Passkey" });

    if (locker.data.length >= 10) return res.status(400).json({ message: "Locker is full" });

    const s3Key = encryptName();
    console.log(`[initUpload] Generated s3Key: ${s3Key}`);

    const params = {
      Bucket: process.env.BUCKET_NAME,
      Key: s3Key,
      ContentType: fileType,
    };

    const command = new PutObjectCommand(params);
    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
    console.log(`[initUpload] Signed URL generated for Key: ${s3Key}`);

    // Do NOT save to DB yet. Wait for client confirmation.
    res.json({
      message: "Presigned URL generated",
      url: signedUrl,
      s3Key: s3Key
    });
  } catch (error) {
    console.error("Init Upload Error:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

// Phase 2: Save metadata after successful S3 upload
const completeUpload = async (req, res) => {
  try {
    const { name, passkey, fileName, s3Key } = decryptObjectValues(req.body);
    console.log(`[completeUpload] Request for Locker: ${name}, s3Key: ${s3Key}`);

    const locker = await model.findOne({ name });

    if (!locker) return res.status(400).json({ message: "Locker doesn't exist" });

    const match = await bcrypt.compare(String(passkey), locker.passkey);
    if (!match) return res.status(400).json({ message: "Incorrect Passkey" });

    // Final Capacity Check
    if (locker.data.length >= 10) return res.status(400).json({ message: "Locker is full" });

    locker.data.push({
      fileUrl: `https://${process.env.BUCKET_NAME}.s3.${process.env.REGION}.amazonaws.com/${s3Key}`,
      fileName: fileName,
      s3Key: s3Key,
    });

    await locker.save();
    console.log(`[completeUpload] Metadata saved for s3Key: ${s3Key}`);
    res.json({ message: "Upload confirmed and saved" });
  } catch (error) {
    console.error("Complete Upload Error:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
}



export { initUpload, completeUpload };
