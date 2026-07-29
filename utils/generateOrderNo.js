export async function generateOrderNumber(prefix = 'ORD') {
    const now = new Date();
    const date = `${now.getFullYear()}${(now.getMonth() + 1)
        .toString()
        .padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
    const random = Math.floor(Math.random() * 9000) + 1000;
    return `${prefix}-${date}-${random}`;
}
  