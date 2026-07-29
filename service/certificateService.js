import certificateRepo from '../repository/certificateRepository.js';
import path from 'path';
import fs from 'fs/promises';
import { StatusCodes } from 'http-status-codes';
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class CertificateService {
  async createCertificate(data) {
    try {
      return await certificateRepo.create(data);
    } catch (error) {
      throw new Error(`Failed to create certificate: ${error.message}`);
    }
  }

  async getCertificateByUserAndType(userId, causerId, type, templateId) {
    try {
      return await certificateRepo.findByUserAndType(userId, causerId, type, templateId);
    } catch (error) {
      throw new Error(`Failed to fetch certificate by user and type: ${error.message}`);
    }
  }

  async getAllCertificates(query) {
    try {
      return await certificateRepo.findAll(query);
    } catch (error) {
      throw new Error(`Failed to fetch certificates: ${error.message}`);
    }
  }

  async getCertificateById(id) {
    try {
      //console.log(`Fetching certificate with ID: ${id}`);
      // findById already populates the fields, so we don't need to populate again
      const certificate = await certificateRepo.findById(id);
      //console.log('Fetched certificate:', certificate);
      if (!certificate) throw new Error('Certificate not found');
      return certificate;
    } catch (error) {
      throw new Error(`Failed to fetch certificate by ID: ${error.message}`);
    }
  }



  async downloadCertificatePdf (id) {
    try {
      const certificate = await certificateRepo.findById(id);
      if (!certificate) {
        const error = new Error("Certificate not found");
        error.statusCode = StatusCodes.NOT_FOUND;
        throw error;
      }

      if (!certificate.certificate_url) {
        const error = new Error("Certificate PDF not available");
        error.statusCode = StatusCodes.BAD_REQUEST;
        throw error;
      }

      const filePath = path.join(__dirname, "..", certificate.certificate_url);
      
      try {
        await fs.access(filePath);
        const fileName = `certificate_${certificate.serial_number || id}.pdf`;
        return { filePath, fileName };
      } catch (error) {
        const err = new Error("Certificate file not found");
        err.statusCode = StatusCodes.NOT_FOUND;
        throw err;
      }
    } catch (error) {
      // Re-throw if it's already a proper error with statusCode
      if (error.statusCode) {
        throw error;
      }
      // Otherwise wrap it
      throw new Error(`Failed to download certificate PDF: ${error.message}`);
    }
  }

  async updateCertificate(id, data) {
    try {
      const updated = await certificateRepo.update(id, data);
      if (!updated) throw new Error('Certificate not found or not updated');
      return updated;
    } catch (error) {
      throw new Error(`Failed to update certificate: ${error.message}`);
    }
  }

  async deleteCertificate(id) {
    try {
      const deleted = await certificateRepo.delete(id);
      if (!deleted) throw new Error('Certificate not found or already deleted');
      return deleted;
    } catch (error) {
      throw new Error(`Failed to delete certificate: ${error.message}`);
    }
  }
}

export default new CertificateService();
