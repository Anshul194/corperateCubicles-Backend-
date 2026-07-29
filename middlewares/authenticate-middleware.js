import passport from "passport";

const authenticate = (req, res, next) => {
  passport.authenticate("jwt", { session: false }, (err, user) => {
    // Must return — otherwise execution falls through and a second response is
    // sent, throwing ERR_HTTP_HEADERS_SENT.
    if (err) return next(err);

    if (!user) {
      return res.status(401).json({
        message: "Unauthorised access no token",
      });
    }
    req.user = user;
    return next();
  })(req, res, next);
};

export { authenticate };
