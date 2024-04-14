import multer from "multer";
import { nanoid } from "nanoid";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/temp");
  },
  filename: function (req, file, cb) {
    const uniquePrefix = nanoid(10);
    cb(null, uniquePrefix + "-" + file.originalname);
  },
});

export const upload = multer({ storage: storage });
