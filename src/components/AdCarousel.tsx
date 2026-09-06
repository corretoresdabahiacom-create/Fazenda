/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query as fsQuery, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Advertisement, AdContentType } from '../types';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Carrossel de publicidade, gerenciado pelo Painel Admin. Troca sozinho a
// cada 5 segundos; o usuário também pode navegar manualmente com as setas.
export default function AdCarousel() {
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const unsub = onSnapshot(
      fsQuery(collection(db, 'advertisements'), where('active', '==', true)),
      (snap) => {
        const today = new Date().toISOString().split('T')[0];
        const list = snap.docs
          .map(d => d.data() as Advertisement)
          .filter(a => (!a.startDate || a.startDate <= today) && (!a.endDate || a.endDate >= today))
          .sort((a, b) => a.order - b.order);
        setAds(list);
      },
      () => setAds([]), // silencioso: publicidade nunca deve travar o app
    );
    return unsub;
  }, []);

  useEffect(() => {
    if (ads.length <= 1) return;
    const timer = setInterval(() => setIndex(i => (i + 1) % ads.length), 5000);
    return () => clearInterval(timer);
  }, [ads.length]);

  if (ads.length === 0) return null;

  const ad = ads[index % ads.length];

  function goTo(delta: number) {
    setIndex(i => (i + delta + ads.length) % ads.length);
  }

  const content = (
    <div className="p-4">
      {ad.type === AdContentType.VIDEO && ad.videoUrl ? (
        <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
          <iframe
            src={ad.videoUrl}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            title={ad.title || 'Anúncio em vídeo'}
          />
        </div>
      ) : ad.imageUrl || ad.type === AdContentType.IMAGEM_LINK || ad.type === AdContentType.BANNER_IMAGEM ? (
        ad.imageUrl && <img src={ad.imageUrl} alt={ad.title || 'Publicidade'} className="w-full rounded-xl object-cover max-h-48" />
      ) : null}
      {ad.title && <h3 className="font-bold text-theme-primary mt-2">{ad.title}</h3>}
      {ad.text && <p className="text-sm text-theme-secondary mt-1">{ad.text}</p>}
    </div>
  );

  return (
    <div className="bg-theme-card border border-theme rounded-2xl relative mt-4">
      <p className="text-[9px] uppercase font-bold text-theme-secondary px-4 pt-2">Publicidade</p>
      {ad.linkUrl ? (
        <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer sponsored" className="block hover:opacity-90 transition-opacity">
          {content}
        </a>
      ) : content}

      {ads.length > 1 && (
        <>
          <button
            onClick={() => goTo(-1)}
            className="absolute left-1 top-1/2 -translate-y-1/2 bg-theme-card/80 backdrop-blur rounded-full p-1.5 shadow-md text-theme-secondary"
            aria-label="Anúncio anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => goTo(1)}
            className="absolute right-1 top-1/2 -translate-y-1/2 bg-theme-card/80 backdrop-blur rounded-full p-1.5 shadow-md text-theme-secondary"
            aria-label="Próximo anúncio"
          >
            <ChevronRight size={16} />
          </button>
          <div className="flex justify-center gap-1 pb-2">
            {ads.map((_, i) => (
              <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === index % ads.length ? 'bg-primary' : 'bg-theme-secondary'}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
