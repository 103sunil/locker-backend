import { encrypt } from "tanmayo7lock";
import fs from "node:fs";
import dotenv from "dotenv";

dotenv.config();

const API_URL = "http://localhost:5000/api";

async function test() {
    const name = "test_" + Date.now();
    const passkey = "123456";

    console.log(`Creating locker: ${name}`);
    const payload = {
        name: encrypt(name),
        passkey: encrypt(passkey)
    };

    const createRes = await fetch(`${API_URL}/locker`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    const createData = await createRes.json();
    console.log("Create response:", createData);

    // Create dummy file
    const fileContent = "Hello S3";
    const blob = new Blob([fileContent], { type: 'text/plain' });
    const fileName = "test.txt";

    console.log("Requesting Presigned URL (Init)...");
    const uploadInitRes = await fetch(`${API_URL}/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: encrypt(name),
            passkey: encrypt(passkey),
            fileName: encrypt(fileName),
            fileType: encrypt("text/plain")
        })
    });

    const uploadInitData = await uploadInitRes.json();
    console.log("Upload Init Response:", uploadInitData);

    if (uploadInitData.url) {
        console.log("Uploading to S3 via Presigned URL...");
        const s3UploadRes = await fetch(uploadInitData.url, {
            method: "PUT",
            headers: { "Content-Type": "text/plain" },
            body: blob
        });
        console.log("S3 Upload Status:", s3UploadRes.status);
        if (s3UploadRes.ok) {
            console.log("Confirming Upload (Complete)...");
            const completeRes = await fetch(`${API_URL}/complete_upload`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: encrypt(name),
                    passkey: encrypt(passkey),
                    fileName: encrypt(fileName),
                    s3Key: encrypt(uploadInitData.s3Key)
                })
            });
            const completeData = await completeRes.json();
            console.log("Complete Response:", completeData);
            if (completeRes.ok) {
                console.log("Reference Code: SUCCESS_2PHASE");
            }
        } else {
            console.log("S3 Upload Failed:", await s3UploadRes.text());
        }
    } else {
        console.log("Failed to get presigned URL: ", uploadInitData);
    }
}

test();
