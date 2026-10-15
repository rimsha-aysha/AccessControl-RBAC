/**
 * Validates req.params / req.query / req.body against zod schemas.
 * Parsed (cleaned) values are stored on req.valid so controllers only read trusted data.
 */
export function validate(schemas) {
  return (req, _res, next) => {
    try {
      req.valid = req.valid || {};
      for (const part of ['params', 'query', 'body']) {
        if (schemas[part]) req.valid[part] = schemas[part].parse(req[part] ?? {});
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
