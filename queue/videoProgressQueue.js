import Queue from 'bull';

let progressQueue = null;

// Only construct the Bull queue (which eagerly opens a Redis connection on
// import) when the video-progress sync feature is explicitly enabled. This
// avoids importing this module unconditionally opening a Redis connection that
// would otherwise auth-fail on a password-protected Redis and emit a continuous
// stream of "Redis connection error" events.
if (process.env.VIDEO_PROGRESS_QUEUE_ENABLED === 'true') {
    try {
        progressQueue = new Queue('video-progress', {
            redis: {
                host: process.env.REDIS_HOST,
                port: process.env.REDIS_PORT,
                password: process.env.REDIS_PASSWORD
            },
            defaultJobOptions: {
                attempts: 5,
                backoff: {
                    type: 'exponential',
                    delay: 5000
                }
            }
        });

        progressQueue.client.on('ready', () => {
            //console.log('Redis connected successfully.');
        });

        progressQueue.client.on('error', (err) => {
            console.error('Redis connection error:', err);
        });

        progressQueue.on('failed', (job, err) => {
            console.error(`video-progress job ${job?.id} failed permanently:`, err?.message);
        });
    } catch (error) {
        console.error('Failed to initialize Redis queue:', error);
    }
}

export default progressQueue;