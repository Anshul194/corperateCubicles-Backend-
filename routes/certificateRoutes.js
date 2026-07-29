import express from "express";
import {
  createCertificate,
  getAllCertificates,
  getCertificateById,
  updateCertificate,
  deleteCertificate,
  downloadCertificatePdf,
  viewCertificatePdf
} from "../controllers/certificateController.js";

import { upload } from "../middlewares/upload-middleware.js";
import accessTokenAutoRefresh from "../middlewares/accessTokenAutoRefresh.js";
import { isAdmin } from "../middlewares/isAdmin.js";
import passport from "passport";

const certificateRouter = express.Router();


certificateRouter.post(
  '/',
  accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false }),
  upload.fields([
    { name: 'certificate_url', maxCount: 1 },
    { name: 'instructor_signature', maxCount: 1 },
  ]),
  createCertificate
);



certificateRouter.get(
  "/",
  accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false }),
  isAdmin,
  getAllCertificates
);
certificateRouter.get(
  "/:id",
  accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false }),
  getCertificateById
);
certificateRouter.get(
  '/:id/pdf',
  accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false }),
  downloadCertificatePdf
);
certificateRouter.get(
  '/:id/view',
  accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false }),
  viewCertificatePdf
);

certificateRouter.put(
  "/:id",
  accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false }),
  isAdmin,
  upload.fields([
    { name: "certificateFile", maxCount: 1 },
    { name: "signatureFile", maxCount: 1 },
  ]),
  updateCertificate
);

certificateRouter.delete(
  "/:id",
  accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false }),
  isAdmin,
  deleteCertificate
);

export default certificateRouter;
