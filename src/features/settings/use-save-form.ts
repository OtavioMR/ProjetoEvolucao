import { useRef, useState } from 'react';

export function useSaveForm() {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  async function save(work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await work();
      setSaved(true);
    } catch {
      setError(
        'Não foi possível salvar ou confirmar a gravação. Reabra a tela para conferir os dados antes de tentar novamente.',
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return { save, busy, error, saved };
}
