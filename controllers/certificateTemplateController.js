import CertificateTemplateService from "../service/certificateTemplateService.js";
import path from "path";
import fs from "fs";

const certificateTemplateService = new CertificateTemplateService();

export const createCertificateTemplate = async (req, res) => {
  try {
    //console.log("Create Certificate Template Request Body:", req.body);
    //console.log("Uploaded Files:", req.files);

    const userId = req.user._id;

    // Process uploaded files
    const files = req.files || {};
    const templateData = {
      ...req.body,
      created_by: userId,
    };

    // Add file paths to templateData if files exist
    if (files["image"]) {
      templateData.image = path.join("uploads", files["image"][0].filename);
    }
    if (files["elements[platform_signature][image]"]) {
      templateData.elements = templateData.elements || {};
      templateData.elements.platform_signature =
        templateData.elements.platform_signature || {};
      templateData.elements.platform_signature.image = path.join(
        "uploads",
        files["elements[platform_signature][image]"][0].filename
      );
    }
    if (files["elements[stamp][image]"]) {
      templateData.elements = templateData.elements || {};
      templateData.elements.stamp = templateData.elements.stamp || {};
      templateData.elements.stamp.image = path.join(
        "uploads",
        files["elements[stamp][image]"][0].filename
      );
    }

    const template = await certificateTemplateService.createCertificateTemplate(
      templateData,
      userId
    );
    return res.status(201).json({
      success: true,
      message: "Certificate template created successfully",
      data: template,
    });
  } catch (error) {
    console.error("Create Certificate Template Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create certificate template",
      error: error.message,
    });
  }
};

export const getCertificateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const template = await certificateTemplateService.getCertificateTemplate(
      id
    );
    return res.status(200).json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error("Get Certificate Template Error:", error);
    return res.status(error.message.includes("not found") ? 404 : 500).json({
      success: false,
      message: "Failed to retrieve certificate template",
      error: error.message,
    });
  }
};

export const getAllCertificateTemplates = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const { templates, totalCount } =
      await certificateTemplateService.getAllCertificateTemplates(
        parseInt(page),
        parseInt(limit)
      );
    return res.status(200).json({
      success: true,
      data: {
        templates,
        totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Get All Certificate Templates Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve certificate templates",
      error: error.message,
    });
  }
};

export const updateCertificateTemplate = async (req, res) => {
  try {
    //console.log("Update Certificate Template Request Body:", req.body);
    //console.log("Uploaded Files:", req.files);

    const { id } = req.params;
    const userId = req.user._id;
    const files = req.files || {};
    const templateData = {
      ...req.body,
      updated_by: userId,
    };

    // Fetch existing template to get old image paths
    const certificateTemplateService = new CertificateTemplateService();
    const existingTemplate =
      await certificateTemplateService.getCertificateTemplate(id);
    if (!existingTemplate) {
      return res.status(404).json({
        success: false,
        message: "Certificate template not found",
      });
    }

    // Store old image paths for potential deletion
    const oldFiles = [];
    if (existingTemplate.image) oldFiles.push(existingTemplate.image);
    if (existingTemplate.elements?.platform_signature?.image) {
      oldFiles.push(existingTemplate.elements.platform_signature.image);
    }
    if (existingTemplate.elements?.stamp?.image) {
      oldFiles.push(existingTemplate.elements.stamp.image);
    }

    // Process new uploaded files
    if (files["image"]) {
      templateData.image = path
        .join("uploads", files["image"][0].filename)
        .replace(/\\/g, "/");
    } else {
      templateData.image = existingTemplate.image;
    }
    if (files["elements[platform_signature][image]"]) {
      templateData.elements = templateData.elements || {};
      templateData.elements.platform_signature =
        templateData.elements.platform_signature || {};
      templateData.elements.platform_signature.image = path
        .join(
          "uploads",
          files["elements[platform_signature][image]"][0].filename
        )
        .replace(/\\/g, "/");
    } else {
      templateData.elements.platform_signature.image =
        existingTemplate.elements.platform_signature.image;
    }
    if (files["elements[stamp][image]"]) {
      templateData.elements = templateData.elements || {};
      templateData.elements.stamp = templateData.elements.stamp || {};
      templateData.elements.stamp.image = path
        .join("uploads", files["elements[stamp][image]"][0].filename)
        .replace(/\\/g, "/");
    } else {
      templateData.elements.stamp.image = existingTemplate.elements.stamp.image;
    }

    // Update the template
    const template = await certificateTemplateService.updateCertificateTemplate(
      id,
      templateData,
      userId
    );

    // Delete old files that were replaced
    // const newFiles = [
    //   templateData.image,
    //   templateData.elements?.platform_signature?.image,
    //   templateData.elements?.stamp?.image,
    // ].filter(Boolean);
    // oldFiles.forEach((file) => {
    //   if (!newFiles.includes(file)) {
    //     const filePath = path.join(process.cwd(), file);
    //     if (fs.existsSync(filePath)) {
    //       fs.unlinkSync(filePath);
    //       //console.log(`Deleted old file: ${filePath}`);
    //     }
    //   }
    // });

    return res.status(200).json({
      success: true,
      message: "Certificate template updated successfully",
      data: template,
    });
  } catch (error) {
    console.error("Update Certificate Template Error:", error);
    return res.status(error.message.includes("not found") ? 404 : 500).json({
      success: false,
      message: "Failed to update certificate template",
      error: error.message,
    });
  }
};

export const deleteCertificateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    await certificateTemplateService.deleteCertificateTemplate(id);
    return res.status(200).json({
      success: true,
      message: "Certificate template deleted successfully",
    });
  } catch (error) {
    console.error("Delete Certificate Template Error:", error);
    return res.status(error.message.includes("not found") ? 404 : 500).json({
      success: false,
      message: "Failed to delete certificate template",
      error: error.message,
    });
  }
};
