class YouTubeService {
  constructor() {
    // No Google API setup needed
  }

  async processYouTubeUrl({ url, title, description, videoLessonId }) {
    try {
      // Extract video ID from URL
      const videoId = this.extractVideoId(url);
      if (!videoId) {
        throw new Error('Invalid YouTube video ID');
      }

      // Construct URLs
      const embedUrl = `https://www.youtube.com/embed/${videoId}`;
      const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
      
      // Optionally fetch thumbnail or metadata using YouTube API
      const thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

      return {
        videoId,
        embedUrl,
        watchUrl,
        thumbnail
      };
    } catch (error) {
      console.error(`Error processing YouTube URL: ${error.message}`);
      return null; // This is likely causing the issue
    }
  }

  extractVideoId(url) {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }

  // Validate if YouTube URL is accessible and properly formatted
  async validateYouTubeUrl(url) {
    try {
      // Basic URL format validation
      if (!url || typeof url !== 'string') {
        return false;
      }

      // Check if it's a YouTube URL
      const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)/;
      if (!youtubeRegex.test(url)) {
        return false;
      }

      // Try to extract video ID
      const videoId = this.extractVideoId(url);
      if (!videoId) {
        return false;
      }

      // Validate video ID format (YouTube video IDs are typically 11 characters)
      const videoIdRegex = /^[a-zA-Z0-9_-]{11}$/;
      return videoIdRegex.test(videoId);
      
    } catch (error) {
      return false;
    }
  }

  // Optional: Get different thumbnail qualities
  getThumbnailUrls(videoId) {
    return {
      default: `https://img.youtube.com/vi/${videoId}/default.jpg`,
      medium: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
      high: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      standard: `https://img.youtube.com/vi/${videoId}/sddefault.jpg`,
      maxres: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
    };
  }

  // Generate embed URL with custom parameters
  generateEmbedUrl(videoId, options = {}) {
    const {
      autoplay = 0,
      controls = 1,
      start = 0,
      end = null,
      loop = 0,
      mute = 0,
      modestbranding = 1
    } = options;

    let embedUrl = `https://www.youtube.com/embed/${videoId}?`;
    
    const params = new URLSearchParams({
      autoplay,
      controls,
      modestbranding,
      ...(start && { start }),
      ...(end && { end }),
      ...(loop && { loop }),
      ...(mute && { mute })
    });

    return embedUrl + params.toString();
  }
}

export default new YouTubeService();