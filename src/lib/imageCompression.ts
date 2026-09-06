/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Comprime imagens no navegador antes de enviar, pra caber num limite
// pequeno (o arquivo fica guardado como texto dentro do próprio Firestore,
// sem custo, sem precisar do Firebase Storage — que hoje exige o plano
// pago Blaze mesmo dentro da faixa gratuita). PDFs e outros tipos não são
// comprimidos aqui — só verificados quanto ao tamanho na hora de salvar.
export async function compressImageIfNeeded(file: File, maxBytes = 650_000): Promise<File> {
  if (!file.type.startsWith('image/') || file.size <= maxBytes) return file;

  const imgUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = imgUrl;
    });

    let quality = 0.85;
    let scale = 1;
    for (let attempt = 0; attempt < 6; attempt++) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob: Blob | null = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
      if (blob && blob.size <= maxBytes) {
        return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
      }
      quality = Math.max(0.4, quality - 0.15);
      if (quality <= 0.4) scale *= 0.8;
    }
    return file; // não conseguiu comprimir o suficiente — deixa a checagem de tamanho avisar
  } finally {
    URL.revokeObjectURL(imgUrl);
  }
}

// Converte um arquivo em base64 (data URL), pronto para guardar direto no
// Firestore.
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
