import { useEffect } from 'react';
import { SpinDb } from './db';
import { createClient } from '@supabase/supabase-js';

// Inicialize seu cliente Supabase safely using env variables or placeholders
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'SUA_URL_DO_SUPABASE';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'SUA_CHAVE_ANON_DO_SUPABASE';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function useSupabaseSync() {
  useEffect(() => {
    const syncVideos = async () => {
      // Se não tiver internet, aborta silenciosamente
      if (!navigator.onLine) return;

      const videos = SpinDb.getVideos();
      
      // Busca vídeos cuja URL ainda seja um 'blob:' local (ou seja, ainda não subiram)
      const pendingVideos = videos.filter(v => v.url.startsWith('blob:'));

      for (const video of pendingVideos) {
        try {
          // 1. Extrai o arquivo físico da memória RAM/IndexedDB usando a URL local
          const response = await fetch(video.url);
          const videoBlob = await response.blob();

          const filePath = `${video.eventId}/${video.slug}.mp4`;

          // 2. Faz o upload em background para o Supabase
          const { error } = await supabase.storage
            .from('videos') // Nome do seu bucket
            .upload(filePath, videoBlob, {
              contentType: 'video/mp4',
              upsert: true
            });

          if (error) throw error;

          // 3. Pega a URL pública permanente gerada pelo Supabase
          const { data } = supabase.storage.from('videos').getPublicUrl(filePath);

          // 4. Atualiza o banco local: troca o link provisório (blob) pelo link da nuvem!
          video.url = data.publicUrl;
          SpinDb.saveVideo(video);
          
          console.log(`[SYNC] Vídeo ${video.slug} salvo na nuvem com sucesso!`);

        } catch (err) {
          console.error(`[SYNC] Falha ao sincronizar o vídeo ${video.slug}:`, err);
          // Ele falha em silêncio e tenta de novo na próxima rodada do intervalo
        }
      }
    };

    // Executa a varredura a cada 30 segundos
    const intervalId = setInterval(syncVideos, 30000);
    
    // Executa uma vez assim que o app abre (caso já tenha internet)
    syncVideos();

    return () => clearInterval(intervalId);
  }, []);
}
