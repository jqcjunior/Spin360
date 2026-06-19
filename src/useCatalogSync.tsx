import { useEffect } from 'react';
import { SpinDb } from './db';
import { createClient } from '@supabase/supabase-js';

// Instância do cliente Supabase safely configured with env vars or fallbacks
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'SUA_URL_DO_SUPABASE';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'SUA_CHAVE_ANON_DO_SUPABASE';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function useCatalogSync() {
  useEffect(() => {
    const syncCatalog = async () => {
      // Se não houver internet no local, a fila não para; o app ignora a busca.
      if (!navigator.onLine) return;

      try {
        // ---------------------------------------------------------
        // 1. SINCRONIZAR MOLDURAS (FRAMES)
        // ---------------------------------------------------------
        const { data: remoteFrames, error: errFrames } = await supabase.from('frames').select('*');
        if (!errFrames && remoteFrames) {
          const localFrames = SpinDb.getFrames();
          remoteFrames.forEach((remote) => {
            const local = localFrames.find(f => f.id === remote.id);
            // Se a moldura não existir no celular, salva na memória local
            if (!local) {
              SpinDb.saveFrame(remote);
            }
          });
        }

        // ---------------------------------------------------------
        // 2. SINCRONIZAR ÁUDIOS (TRACKS)
        // ---------------------------------------------------------
        const { data: remoteTracks, error: errTracks } = await supabase.from('tracks').select('*');
        if (!errTracks && remoteTracks) {
          const localTracks = SpinDb.getMusicTracks();
          remoteTracks.forEach((remote) => {
            const local = localTracks.find(t => t.id === remote.id);
            // Se o áudio não existir no celular, salva na memória local
            if (!local) {
              SpinDb.saveMusicTrack(remote);
            }
          });
        }

        // ---------------------------------------------------------
        // 3. SINCRONIZAR EVENTOS (MASTER)
        // ---------------------------------------------------------
        const { data: remoteEvents, error: errEvents } = await supabase.from('events').select('*');
        if (!errEvents && remoteEvents) {
          const localEvents = SpinDb.getEvents();
          let eventsUpdated = false;

          remoteEvents.forEach((remote) => {
            const local = localEvents.find(e => e.id === remote.id);
            // Salva se o evento for novo ou se a versão do PC for mais recente que a do celular
            if (!local || new Date(remote.updatedAt) > new Date(local.updatedAt)) {
              SpinDb.saveEvent(remote);
              eventsUpdated = true;
            }
          });

          if (eventsUpdated) {
             console.log('📡 [SYNC] Catálogo geral (Eventos, Áudios e Molduras) atualizado!');
          }
        }

      } catch (err) {
        console.warn('📡 [SYNC] Falha ao sincronizar catálogo do servidor:', err);
      }
    };

    // Executa a primeira varredura ao abrir o PWA
    syncCatalog();

    // Mantém verificando silenciosamente a cada 1 minuto (60000ms)
    const intervalId = setInterval(syncCatalog, 60000);

    return () => clearInterval(intervalId);
  }, []);
}
