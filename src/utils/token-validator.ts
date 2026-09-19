export const isValidToken = (token: string): boolean => {
  try {
    const decodedToken = Buffer.from(token, "base64").toString("utf-8");
    const tokenJSON = JSON.parse(decodedToken);
    const { a, t, s } = tokenJSON;
    if (!a || !t || !s) return false;
    return true;
  }
  catch {
    return false;
  }
};
