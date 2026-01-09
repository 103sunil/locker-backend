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

const uploadFile = async (req, res) => {
  try {
    const { name, passkey, fileName, fileType } = decryptObjectValues(req.body);
    const locker = await model.findOne({ name });

    if (!locker) {
      return res.status(400).json({ message: "Locker doesn't exists" });
    }
    const match = await bcrypt.compare(String(passkey), locker.passkey);

    if (!match) {
      return res.status(400).json({ message: "Incorrect Passkey" });
    }
    if (locker.data.length >= 10) {
      return res.status(400).json({ message: "Locker is full" });
    }

    const s3Key = encryptName();
    const params = {
      Bucket: process.env.BUCKET_NAME,
      Key: s3Key,
      ContentType: fileType,
    };

    const command = new PutObjectCommand(params);
    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

    locker.data.push({
      fileUrl: `https://${process.env.BUCKET_NAME}.s3.${process.env.REGION}.amazonaws.com/${s3Key}`,
      fileName: fileName,
      s3Key: s3Key,
    });

    await locker.save();

    res.json({
      message: "Presigned URL generated",
      url: signedUrl,
      s3Key: s3Key,
      fileName: fileName
    });
  } catch (error) {
    console.error("Upload Error:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};



export { uploadFile };
