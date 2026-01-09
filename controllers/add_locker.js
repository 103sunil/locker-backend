import { decryptObjectValues } from "../config/utils.js";
import model from "../schema/locker.js";
import bcrypt from "bcrypt";

const add_locker = async (req, res, next) => {
  const { name } = decryptObjectValues(req.body);
  if (!name) {
    return res.status(400).json({
      message: "Name is required",
    });
  }
  const findName = await model.findOne({ name });
  if (findName) {
    return res.status(400).json({
      message: "Name already exists",
    });
  } else {
    const { passkey } = decryptObjectValues(req.body);
    if (!passkey) {
      return res.status(400).json({
        message: "Passkey is required",
      });
    }
    const key = bcrypt.hashSync(String(passkey), 10);
    const newLocker = new model({
      name: name,
      passkey: key,
      data: [], // Initialize data array
    });
    await newLocker.save();
    return res.status(200).json({ message: "Locker Created" });
  }
};

export { add_locker };
