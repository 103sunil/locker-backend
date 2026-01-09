import model from "../schema/locker.js";
import bcrypt from "bcrypt";
import { s3 } from "../config/aws.js";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { decryptObjectValues } from "../config/utils.js";

const delete_file = async (req, res) => {
  try {
    const { name, passkey, fileName } = decryptObjectValues(req.body);
    console.log(`[delete_file] Request to delete file: '${fileName}' from locker: '${name}'`);

    const locker = await model.findOne({ name: name }).exec();
    if (locker) {
      const match = await bcrypt.compare(String(passkey), locker.passkey);
      if (match) {
        // Robust matching: trim whitespace and check
        const targetFileName = fileName.trim();
        const file = locker.data.find((file) => file.fileName.trim() === targetFileName);

        if (file) {
          const params = {
            Bucket: process.env.BUCKET_NAME,
            Key: file.s3Key || file.fileName,
          };

          try {
            console.log(`[delete_file] Attempting to delete from S3 with Key: ${params.Key}`);
            const command = new DeleteObjectCommand(params);
            await s3.send(command);
            console.log(`[delete_file] S3 delete successful (or ignored if missing)`);
          } catch (s3Error) {
            console.error(`[delete_file] S3 delete failed (ignoring to allow DB cleanup):`, s3Error);
          }

          locker.data = locker.data.filter((file) => file.fileName !== fileName);
          await locker.save();
          console.log(`[delete_file] DB updated. File '${fileName}' removed.`);
          res.json({ status: 1, message: "File Deleted" });
        } else {
          console.warn(`[delete_file] File '${fileName}' not found in locker data.`);
          // Dump available filenames to log to help debugging
          console.log(`[delete_file] Available files:`, locker.data.map(f => f.fileName));
          res.status(400).json({ status: 0, message: "File Not Found" });
        }
      } else {
        console.warn(`[delete_file] Incorrect passkey for locker: '${name}'`);
        res.status(400).json({ status: 0, message: "Incorrect Passkey" });
      }
    } else {
      console.warn(`[delete_file] Locker not found: '${name}'`);
      res.status(400).json({ status: 0, message: "Locker Not Found" });
    }
  } catch (error) {
    console.error(`[delete_file] Unexpected error:`, error);
    res.status(500).json({ status: 0, message: "Internal Server Error" });
  }
};

export { delete_file };
