import axios from "axios";
import FormData from "form-data";
import fs from "fs";

class VideoCypherService {
  constructor() {
    this.apiKey = process.env.VIDEOCYPHER_API_KEY;
    this.baseUrl = "https://dev.vdocipher.com/api"; // For all API operations
  }

  _ensureApiKey() {
    if (!this.apiKey) {
      throw new Error("VIDEOCYPHER_API_KEY is required. Please set it in your environment variables.");
    }
  }

  async uploadVideo({ file, title, description, folderId }) {
    this._ensureApiKey();
    try {
      //console.log("🚀 Starting VideoCypher upload process...");

      // Step 1: Create video entry
      const videoData = await this.createVideoEntry(title, description, folderId);
      //console.log("✅ Video entry created:", videoData.videoId);

      // Step 2: Upload video file to S3
      await this.uploadFileToS3(file?.path, videoData.clientPayload);
      //console.log("✅ File uploaded to S3 successfully");

      // Step 3: Poll for OTP & Playback info (wait for processing)
      let playbackInfo = null;
      let retries = 0;
      const isProduction = process.env.NODE_ENV === "production";
      const maxRetries = isProduction ? 20 : 6;
      const delay = isProduction ? 10000 : 5000; // 10s for prod, 5s for dev

      while (retries < maxRetries) {
        try {
          //console.log(`⏳ Fetching playback info (attempt ${retries + 1})...`);
          playbackInfo = await this.getPlaybackInfo(videoData.videoId);

          if (playbackInfo?.otp && playbackInfo?.playbackInfo) {
            //console.log("✅ Playback info ready");
            break;
          }
        } catch (err) {
          console.warn("⚠️ Waiting for processing...");
        }

        await new Promise((res) => setTimeout(res, delay));
        retries++;
      }

      if (!playbackInfo?.otp || !playbackInfo?.playbackInfo) {
        throw new Error(
          "Video not ready for playback after upload. Please try again later."
        );
      }

      return {
        videoId: videoData.videoId,
        playbackUrl:
          playbackInfo.hlsUrl ||
          playbackInfo.dashUrl ||
          `https://player.vdocipher.com/v2/?otp=${playbackInfo.otp}&playbackInfo=${playbackInfo.playbackInfo}`,
        secureUrl: `https://player.vdocipher.com/v2/?otp=${playbackInfo.otp}&playbackInfo=${playbackInfo.playbackInfo}`,
        thumbnail: videoData.poster || "",
        uploadStatus: "processing",
        otp: playbackInfo.otp,
        playbackInfo: playbackInfo.playbackInfo,
      };
    } catch (error) {
      console.error(
        "❌ VideoCypher upload error:",
        error.response?.data || error.message
      );
      throw new Error(
        `VideoCypher upload failed: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  }

  async createVideoEntry(title, description, folderId) {
    this._ensureApiKey();
    try {
      const params = new URLSearchParams();
      params.append("title", title || "Untitled Video");
      if (folderId) params.append("folderId", folderId);

      const payload = {};
      if (description) payload.description = description;

      //console.log(
      //   "Creating video entry with params:",
      //   params.toString(),
      //   "and payload:",
      //   payload
      // );

      const response = await axios.put(
        `${this.baseUrl}/videos?${params.toString()}`,
        payload,
        {
          headers: {
            Authorization: `Apisecret ${this.apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          timeout: 30000,
        }
      );

      //console.log("VideoCypher create response:", response.data);
      return response.data;
    } catch (error) {
      console.error("Create video entry error:", {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers,
      });
      throw error;
    }
  }

  async uploadFileToS3(filePath, clientPayload) {
    const form = new FormData();
    //console.log("Uploading file to S3 with payload:", clientPayload);
    //console.log("File path:", filePath);

    form.append("key", clientPayload.key);
    form.append("policy", clientPayload.policy);
    form.append("x-amz-signature", clientPayload["x-amz-signature"]);
    form.append("x-amz-algorithm", clientPayload["x-amz-algorithm"]);
    form.append("x-amz-date", clientPayload["x-amz-date"]);
    form.append("x-amz-credential", clientPayload["x-amz-credential"]);
    form.append("success_action_status", "201");
    form.append("success_action_redirect", "");

    // Handle both file object and direct path
    const fileStream =
      typeof filePath === "string"
        ? fs.createReadStream(filePath)
        : fs.createReadStream(filePath.path || filePath);

    form.append("file", fileStream);

    try {
      const res = await axios.post(clientPayload.uploadLink, form, {
        headers: form.getHeaders(),
        maxBodyLength: Infinity,
      });

      //console.log("✅ File uploaded to S3 successfully");
      return res;
    } catch (err) {
      console.error("❌ S3 Upload failed:", err?.response?.data || err.message);
      throw err;
    }
  }

  async getPlaybackInfo(videoId) {
    this._ensureApiKey();
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const response = await axios.post(
        `${this.baseUrl}/videos/${videoId}/otp`,
        {},
        {
          headers: {
            Authorization: `Apisecret ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error("Get playback info error:", error.response?.data);
      return {
        otp: null,
        playbackInfo: null,
        hlsUrl: null,
        dashUrl: null,
      };
    }
  }

  async getVideoStatus(videoId) {
    this._ensureApiKey();
    try {
      const response = await axios.get(`${this.baseUrl}/videos/${videoId}`, {
        headers: {
          Authorization: `Apisecret ${this.apiKey}`,
          Accept: "application/json",
        },
      });

      return response.data;
    } catch (error) {
      console.error("Get video status error:", error.response?.data);
      throw error;
    }
  }

  async updateVideoMetadata(videoId, metadata) {
    this._ensureApiKey();
    try {
      const response = await axios.post(
        `${this.baseUrl}/videos/${videoId}`,
        metadata,
        {
          headers: {
            Authorization: `Apisecret ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error("Update metadata error:", error.response?.data);
      console.warn(
        "Failed to update video metadata, but upload was successful"
      );
    }
  }

  async validateApiKey() {
    this._ensureApiKey();
    try {
      const response = await axios.get(`${this.baseUrl}/videos?rows=1`, {
        headers: {
          Authorization: `Apisecret ${this.apiKey}`,
          Accept: "application/json",
        },
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async deleteVideo(videoId) {
    this._ensureApiKey();
    const deleteUrl = `${this.baseUrl}/videos?videos=${encodeURIComponent(videoId)}`;

    //console.log('deleteUrl', deleteUrl);

    try {
      if (!videoId || typeof videoId !== "string" || videoId.trim() === "") {
        console.error(
          `❌ Invalid videoId provided for deletion: videoId=${videoId}, URL=${deleteUrl}`
        );
        throw new Error("Invalid videoId provided for deletion");
      }

      // Verify video exists before deletion
      //console.log(`ℹ️ Checking video status before deletion: videoId=${videoId}`);
      try {
        await this.getVideoStatus(videoId);
      } catch (statusError) {
        if (statusError.response?.status === 404) {
          console.warn(
            `⚠️ Video not found in VideoCypher: videoId=${videoId}. Assuming already deleted.`
          );
          return { message: "Video already deleted or not found" };
        }
        throw statusError;
      }

      //console.log(
      //   `🗑️ Initiating deletion of VideoCypher video: videoId=${videoId}, URL=${deleteUrl}`
      // );

      const response = await axios.delete(deleteUrl, {
        headers: {
          Authorization: `Apisecret ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      });

      //console.log(
      //   `✅ Successfully deleted video from VideoCypher: videoId=${videoId}`,
      //   response.data
      // );
      return response.data;
    } catch (error) {
      console.error(
        `❌ Error deleting VideoCypher video: videoId=${videoId}, URL=${deleteUrl}`,
        {
          message: error.message,
          response: error?.response?.data,
          status: error?.response?.status,
        }
      );
      throw new Error(`Failed to delete video from VideoCypher: ${error.message}`);
    }
  }
}

export default new VideoCypherService();