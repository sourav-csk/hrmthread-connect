import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, RotateCcw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadFaceModels, getFaceDescriptor } from "@/lib/faceApi";
import { toast } from "sonner";

interface Props {
  onCapture: (data: { blob: Blob; descriptor: number[] | null }) => void;
  onCancel?: () => void;
  requireFace?: boolean;
}

export default function SelfieCapture({ onCapture, onCancel, requireFace = true }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const blobRef = useRef<Blob | null>(null);
  const descRef = useRef<number[] | null>(null);

  useEffect(() => {
    loadFaceModels().then(() => setModelsReady(true)).catch(() => setModelsReady(true));
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 480 } },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setStreaming(true);
        }
      } catch (e: any) {
        toast.error("Camera access denied");
      }
    })();
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const capture = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setBusy(true);
    const v = videoRef.current;
    const c = canvasRef.current;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d")!;
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, 0, 0, c.width, c.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const desc = await getFaceDescriptor(c).catch(() => null);
    if (requireFace && !desc) {
      setBusy(false);
      toast.error("No face detected — center your face and retry");
      return;
    }
    descRef.current = desc;

    c.toBlob(
      (blob) => {
        if (!blob) { setBusy(false); return; }
        blobRef.current = blob;
        setSnapshot(URL.createObjectURL(blob));
        setBusy(false);
      },
      "image/jpeg",
      0.85
    );
  };

  const retake = () => {
    setSnapshot(null);
    blobRef.current = null;
    descRef.current = null;
  };

  const confirm = () => {
    if (!blobRef.current) return;
    onCapture({ blob: blobRef.current, descriptor: descRef.current });
  };

  return (
    <div className="space-y-4">
      <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-secondary border border-border">
        {!snapshot ? (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
            {(!streaming || !modelsReady) && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-sm text-muted-foreground">
                  {!streaming ? "Starting camera…" : "Loading face model…"}
                </span>
              </div>
            )}
            <div className="absolute inset-6 border-2 border-primary/60 rounded-full pointer-events-none" />
          </>
        ) : (
          <img src={snapshot} alt="Selfie" className="w-full h-full object-cover" />
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="flex gap-3">
        {!snapshot ? (
          <>
            {onCancel && (
              <Button variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
            )}
            <Button
              onClick={capture}
              disabled={!streaming || busy}
              className="flex-1 gradient-accent text-primary-foreground font-semibold"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Camera className="h-4 w-4" /> Capture</>}
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={retake} className="flex-1">
              <RotateCcw className="h-4 w-4" /> Retake
            </Button>
            <Button onClick={confirm} className="flex-1 gradient-accent text-primary-foreground font-semibold">
              <Check className="h-4 w-4" /> Use photo
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
