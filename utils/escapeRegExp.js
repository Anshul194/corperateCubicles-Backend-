// Escapes regex metacharacters in user-supplied input and caps length to
// prevent ReDoS / regex-injection when building $regex or new RegExp queries.
export const escapeRegExp = (s = '') =>
  String(s).slice(0, 200).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default escapeRegExp;
