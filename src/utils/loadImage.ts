export const loadImage = (
  url: string
): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };

    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };

    setTimeout(() => {
      reject(new Error("Image load timeout"));
    }, 5000);

    img.src = url;
  });
};
