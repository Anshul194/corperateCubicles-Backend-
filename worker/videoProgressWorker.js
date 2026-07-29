import dotenv from 'dotenv';
import axios from 'axios';
import progressQueue from '../queue/videoProgressQueue.js';

dotenv.config();

progressQueue.process(async (job) => {
  const { videoId, userId, currentTime } = job.data;

  try {
    const response = await axios.post(
      process.env.VDOCIPHER_API,
      { videoId, currentTime },
      {
        headers: {
          Authorization: `Apisecret ${process.env.VDOCIPHER_SECRET}`
        }
      }
    );

    //console.log(`Synced video ${videoId} progress for user ${userId}: ${response.status}`);
  } catch (err) {
    if (err.response?.status === 429) {
      console.warn(`Rate limited: retrying ${videoId} for ${userId}`);
      await job.moveToDelayed(Date.now() + 60000);
    } else {
      console.error(`VdoCipher sync failed for ${videoId}:`, err.message);
    }
  }
});
