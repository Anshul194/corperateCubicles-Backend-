import passport from "passport";

/**
 * Middleware that attempts to authenticate the user via JWT.
 * Unlike the standard authenticate middleware, it does NOT return a 401 error if authentication fails.
 * It simply proceeds to the next middleware, with req.user populated if authentication was successful.
 */
const optionalAuthenticate = (req, res, next) => {
    passport.authenticate("jwt", { session: false }, (err, user) => {
        if (err) {
            // Log error but proceed
            console.error("Optional Authentication Error:", err);
            return next();
        }
        if (user) {
            req.user = user;
        }
        next();
    })(req, res, next);
};

export default optionalAuthenticate;
