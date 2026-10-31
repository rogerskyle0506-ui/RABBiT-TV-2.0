import { useMemo } from "react";
import { getActiveHoliday, type Holiday } from "@/lib/holiday-theme";

function HalloweenOverlay() {
  // A few fixed pumpkins so it stays light on low-end devices
  const pumpkins = useMemo(
    () => [
      { top: "8%", left: "6%", size: 28, delay: "0s", duration: "6s" },
      { top: "18%", right: "7%", size: 22, delay: "1.2s", duration: "7s" },
      { bottom: "22%", left: "9%", size: 26, delay: "0.6s", duration: "5.5s" },
      { bottom: "12%", right: "11%", size: 20, delay: "2s", duration: "6.5s" },
      { top: "42%", left: "3%", size: 18, delay: "1.8s", duration: "8s" },
    ],
    []
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden>
      <style>{`
        @keyframes floatPumpkin {
          0%, 100% { transform: translateY(0) rotate(-4deg); }
          50% { transform: translateY(-14px) rotate(4deg); }
        }
        .pumpkin {
          position: absolute;
          animation: floatPumpkin ease-in-out infinite;
          filter: drop-shadow(0 4px 6px rgba(0,0,0,0.45));
          opacity: 0.85;
          user-select: none;
        }
      `}</style>

      {pumpkins.map((p, i) => (
        <div
          key={i}
          className="pumpkin"
          style={{
            top: p.top,
            bottom: p.bottom,
            left: p.left,
            right: p.right,
            fontSize: p.size,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        >
          🎃
        </div>
      ))}
    </div>
  );
}

function ChristmasOverlay() {
  // Soft falling snow – limited number of flakes for performance
  const flakes = useMemo(() => {
    return Array.from({ length: 28 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      size: 8 + Math.random() * 10,
      duration: `${7 + Math.random() * 9}s`,
      delay: `${Math.random() * 8}s`,
      opacity: 0.35 + Math.random() * 0.45,
    }));
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden>
      <style>{`
        @keyframes fallSnow {
          0% { transform: translateY(-10vh) translateX(0); }
          100% { transform: translateY(110vh) translateX(20px); }
        }
        .snowflake {
          position: absolute;
          top: -5vh;
          color: #e0f2fe;
          animation: fallSnow linear infinite;
          user-select: none;
        }
      `}</style>

      {flakes.map((f) => (
        <div
          key={f.id}
          className="snowflake"
          style={{
            left: f.left,
            fontSize: f.size,
            animationDuration: f.duration,
            animationDelay: f.delay,
            opacity: f.opacity,
          }}
        >
          ❄
        </div>
      ))}
    </div>
  );
}

function ValentinesOverlay() {
  const hearts = useMemo(() => {
    return Array.from({ length: 18 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      size: 12 + Math.random() * 14,
      duration: `${8 + Math.random() * 8}s`,
      delay: `${Math.random() * 7}s`,
      opacity: 0.4 + Math.random() * 0.4,
    }));
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden>
      <style>{`
        @keyframes fallHeart {
          0% { transform: translateY(-10vh) rotate(0deg); }
          100% { transform: translateY(110vh) rotate(25deg); }
        }
        .heart {
          position: absolute;
          top: -5vh;
          color: #fb7185;
          animation: fallHeart linear infinite;
          user-select: none;
        }
      `}</style>

      {hearts.map((h) => (
        <div
          key={h.id}
          className="heart"
          style={{
            left: h.left,
            fontSize: h.size,
            animationDuration: h.duration,
            animationDelay: h.delay,
            opacity: h.opacity,
          }}
        >
          ❤️
        </div>
      ))}
    </div>
  );
}

export function HolidayOverlay() {
  const holiday: Holiday = getActiveHoliday();

  if (!holiday) return null;

  if (holiday === "halloween") return <HalloweenOverlay />;
  if (holiday === "christmas") return <ChristmasOverlay />;
  if (holiday === "valentines") return <ValentinesOverlay />;

  return null;
}
