import PhoneScreen from "./features/call/components/PhoneScreen";
import ScenarioSelector from "./features/simulation/components/ScenarioSelector";
import VoiceSimulatorPanel from "./features/simulation/components/VoiceSimulatorPanel";
import AIDecisionPanel from "./features/simulation/components/AIDecisionPanel";
import SaaSTelemetryPanel from "./features/simulation/components/SaaSTelemetryPanel";
import SolanaLedgerCard from "./features/payment/components/SolanaLedgerCard";
import DecisionTimeline from "./features/simulation/components/DecisionTimeline";
import useCallSimulation from "./features/simulation/hooks/useCallSimulation";
import { WorkspaceLayout } from "./components/layout/WorkspaceLayout";
import Hook from "./components/Hook";
import { DEMO_MODE } from "./config/runtime";

export default function App() {
  const sim = useCallSimulation();

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const handleStartCallFromHero = () => {
    sim.setMobileTab("call");
    scrollToSection("simulation-workspace");

    // Không reset hoặc làm gián đoạn demo đang chạy.
    if (sim.simStatus === "Sẵn sàng" && !sim.isSimulating) {
      setTimeout(() => {
        sim.startSimulation();
      }, 420);
    }
  };

  const handleDemoFlowFromHero = () => {
    sim.setMobileTab("call");
    scrollToSection("simulation-workspace");
  };

  const handleProofFromHero = () => {
    scrollToSection("verification-proof");
  };

  const handleCampaignFromHero = () => {
    scrollToSection("scenario-selector");
  };

  // Computes the single Call-to-Cash Readiness score
  const getReadinessScore = () => {
    if (sim.simStatus === "Sẵn sàng") return 0;
    if (sim.ledgerLogs.show) return 98;

    if (
      sim.simStatus === "Chờ thanh toán cọc" ||
      sim.simStatus === "Đang cọc (Solana Pay)..."
    ) {
      return 94;
    }

    if (sim.scores.completeness >= 85) return 88;
    if (sim.bookingData.phone) return 76;
    if (sim.bookingData.seats) return 58;

    return 20;
  };

  const getAIDecision = () => {
    if (sim.simStatus === "Sẵn sàng") {
      return {
        understood: "Chưa bắt đầu cuộc đàm thoại.",
        missing:
          "Yêu cầu đầy đủ: lộ trình, giờ chạy, số lượng hành khách, SĐT liên hệ, xác nhận cọc.",
        risk: "N/A",
        gate: "ĐÃ KHÓA / CHƯA ĐỦ ĐIỀU KIỆN",
        next: "Bấm nút micro để tiếp nhận kết nối cuộc gọi.",
      };
    }

    if (sim.ledgerLogs.show) {
      return {
        understood: `${sim.bookingData.route || "Sa Pa"}, ${sim.bookingData.time
          }, ${sim.bookingData.seats}, SĐT: ${sim.bookingData.phone || "0912***678"
          }`,
        missing: "Không. Giao dịch đã hoàn tất thành công.",
        risk: sim.isTampered
          ? "NGUY HIỂM (SAI KHỚP HASH)"
          : "AN TOÀN / THẤP",
        gate: "ĐÃ XÁC THỰC / KHÓA",
        next: sim.isTampered
          ? "⚠ Từ chối vé xe. Yêu cầu bộ phận an ninh can thiệp và kiểm tra thủ công."
          : "Cấp biên nhận xác minh. Chúc khách hàng thượng lộ bình an!",
      };
    }

    if (
      sim.simStatus === "Chờ thanh toán cọc" ||
      sim.simStatus === "Đang cọc (Solana Pay)..."
    ) {
      return {
        understood: `${sim.bookingData.route || "Hà Nội -> Sa Pa"}, ${sim.bookingData.time
          }, ${sim.bookingData.seats}, SĐT: ${sim.bookingData.phone || "0912***678"
          }`,
        missing: "Không. Đang đợi hành khách quét mã chuyển tiền cọc.",
        risk: "AN TOÀN / THẤP",
        gate: "ĐÃ MỞ / SẴN SÀNG",
        next: "Đang kiểm tra xác thực mạng lưới Solana & neo băm thỏa thuận đặt vé.",
      };
    }

    const understood = [];

    if (sim.bookingData.route) {
      understood.push(`Tuyến: ${sim.bookingData.route}`);
    }

    if (sim.bookingData.time) {
      understood.push(`Giờ: ${sim.bookingData.time}`);
    }

    if (sim.bookingData.seats) {
      understood.push(`Khách: ${sim.bookingData.seats}`);
    }

    if (sim.bookingData.phone) {
      understood.push(`SĐT: ${sim.bookingData.phone}`);
    }

    const missing = [];

    if (!sim.bookingData.route) missing.push("lộ trình");
    if (!sim.bookingData.time) missing.push("giờ chạy");
    if (!sim.bookingData.seats) missing.push("số khách");
    if (!sim.bookingData.phone) missing.push("số điện thoại");

    const transMissing = {
      "lộ trình": "lộ trình hành trình",
      "giờ chạy": "khung giờ khởi hành",
      "số khách": "số lượng hành khách đi cùng",
      "số điện thoại": "số điện thoại liên hệ",
    };

    const next =
      missing.length > 0
        ? `Đặt câu hỏi để lấy thông tin về ${transMissing[missing[0]] || missing[0]
        }.`
        : "Đọc to điều khoản cọc bảo lưu và yêu cầu khách hàng xác nhận sự đồng ý.";

    return {
      understood: understood.join(", ") || "Đang nhận diện giọng nói...",
      missing:
        missing.join(", ") ||
        "Thông tin đã đủ. Cần khách xác nhận đồng ý đặt cọc.",
      risk:
        sim.scores.dispute > 50 ? "TRUNG BÌNH / CAO" : "AN TOÀN / THẤP",
      gate:
        sim.scores.completeness >= 85 &&
          sim.scores.readiness >= 80 &&
          sim.scores.dispute <= 35
          ? "ĐÃ MỞ / SẴN SÀNG"
          : "ĐÃ KHÓA / CHƯA ĐỦ ĐIỀU KIỆN",
      next,
    };
  };

  const decision = getAIDecision();
  const readinessScore = getReadinessScore();

  // Product header: desktop/tablet only.
  const headerContent = (
    <header className="flex flex-col items-start justify-between gap-4 bg-white p-5 min-[1024px]:flex-row min-[1024px]:items-center">
      <div>
        <h1 className="text-balance text-xl font-bold tracking-tight text-[#111827]">
          Call-to-Cash <span className="text-[#059669]">Risk Copilot</span>
        </h1>

        <p className="mt-1 max-w-2xl text-balance text-xs leading-[18px] font-normal text-[#6b7280]">
          Agora x Solana: Trợ lý AI giám sát rủi ro hội thoại, tự động đối soát
          và neo băm khóa cọc giao dịch thời gian thực
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="min-h-6 whitespace-nowrap rounded-full bg-[#f3f4f6] px-2.5 py-1 text-xs leading-4 font-medium text-[#6b7280]">
          {DEMO_MODE
            ? "DEMO MODE · DETERMINISTIC"
            : "LIVE MODE · ADAPTERS PENDING"}
        </span>

        <div className="flex min-h-6 items-center gap-1.5 rounded-full border border-[#a7f3d0] bg-[#ecfdf5] px-2.5 py-1 text-xs leading-4 font-medium text-[#065f46]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#10b981]" />
          <span>
            {DEMO_MODE ? "Agora: Transcript Replay" : "Agora: Chưa kết nối"}
          </span>
        </div>

        <div className="flex min-h-6 items-center gap-1.5 rounded-full border border-[#a7f3d0] bg-[#ecfdf5] px-2.5 py-1 text-xs leading-4 font-medium text-[#065f46]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#10b981]" />
          <span>
            {DEMO_MODE
              ? "Payment: Deterministic Mock"
              : "Solana: Chưa kết nối"}
          </span>
        </div>
      </div>
    </header>
  );

  // Hero must be passed separately from header.
  // WorkspaceLayout renders it after the product header.
  const heroContent = (
    <Hook
      onPrimaryAction={handleStartCallFromHero}
      onSecondaryAction={handleDemoFlowFromHero}
      onProofAction={handleProofFromHero}
      onCampaignAction={handleCampaignFromHero}
      campaignText="Trải nghiệm pilot Call-to-Cash với các kịch bản đặt vé và cọc mô phỏng trước khi triển khai vận hành thật."
    />
  );

  // Left Column Content: transcript + AI decision
  const leftContent = (
    <>
      <VoiceSimulatorPanel
        simStatus={sim.simStatus}
        transcript={sim.transcript}
        startSimulation={sim.startSimulation}
        resetSimulation={sim.resetSimulation}
        isSimulating={sim.isSimulating}
        readinessScore={readinessScore}
      />

      <AIDecisionPanel decision={decision} scores={sim.scores} />
    </>
  );

  // Center Column Content: customer phone app
  const centerContent = (
    <PhoneScreen
      isMobileLayout={sim.isMobile}
      activeTab={sim.mobileTab}
      setActiveTab={sim.setMobileTab}
      isSimulating={sim.isSimulating}
      simStatus={sim.simStatus}
      phoneCallStatusText={sim.phoneCallStatusText}
      phoneCallColor={sim.phoneCallColor}
      isWaveAnimating={sim.isWaveAnimating}
      subtitles={sim.subtitles}
      bookingData={sim.bookingData}
      showBoardingPass={sim.showBoardingPass}
      showPaymentDrawer={sim.showPaymentDrawer}
      drawerTimerText={sim.drawerTimerText}
      btnPhonePayText={sim.btnPhonePayText}
      btnPhonePayDisabled={sim.btnPhonePayDisabled}
      btnPhonePayBg={sim.btnPhonePayBg}
      simulateWalletPayment={sim.simulateWalletPayment}
      startSimulation={sim.startSimulation}
      resetSimulation={sim.resetSimulation}
      tamperAgreement={sim.tamperAgreement}
      isTampered={sim.isTampered}
      scores={sim.scores}
      performance={sim.performance}
      brainMode={sim.brainMode}
      showPrefetch={sim.showPrefetch}
      prefetchContent={sim.prefetchContent}
      timelineSteps={sim.timelineSteps}
      ledgerLogs={sim.ledgerLogs}
    />
  );

  // Right Column Content: telemetry + immutable ledger proof + timeline
  const rightContent = (
    <>
      <SaaSTelemetryPanel
        performance={sim.performance}
        brainMode={sim.brainMode}
        showPrefetch={sim.showPrefetch}
        prefetchContent={sim.prefetchContent}
        scores={sim.scores}
        bookingData={sim.bookingData}
        ledgerLogs={sim.ledgerLogs}
      />

      <div
        id="verification-proof"
        className="scroll-mt-6"
        aria-label="Bằng chứng xác thực giao dịch"
      >
        <SolanaLedgerCard
          ledgerLogs={sim.ledgerLogs}
          isTampered={sim.isTampered}
          bookingData={sim.bookingData}
          tamperAgreement={sim.tamperAgreement}
        />
      </div>

      <DecisionTimeline timelineSteps={sim.timelineSteps} />
    </>
  );

  // Scenario Selector: desktop/tablet only through WorkspaceLayout.
  const scenarioSelectorContent = (
    <div id="scenario-selector" className="scroll-mt-6">
      <ScenarioSelector
        currentScenarioIdx={sim.currentScenarioIdx}
        selectScenario={sim.selectScenario}
      />
    </div>
  );

  return (
    <WorkspaceLayout
      header={headerContent}
      hero={heroContent}
      scenarios={scenarioSelectorContent}
      left={leftContent}
      center={centerContent}
      right={rightContent}
    />
  );
}