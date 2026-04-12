import * as Phaser from "phaser";
import { bazaarEventBridge } from "@/game/core/event-bridge";
import { bazaarGameStore } from "@/game/core/store";
import type { WorldReactionState } from "@/game/core/live-types";
import { buildProofArtifacts } from "@/game/systems/proof-service";
import { transactionService } from "@/game/systems/transaction-service";
import { deriveWorldState } from "@/game/systems/world-state-service";
import { bazaarAudioSystem } from "@/game/systems/audio-system";
import { BaseWorldScene } from "./base-world-scene";

type VoteZoneId = "aye" | "nay";

function shortHash(input?: string) {
  if (!input) {
    return "AWAITING-TX";
  }

  return `${input.slice(0, 8)}...${input.slice(-6)}`;
}

export class CouncilHeroSystem {
  private readonly hearth: Phaser.GameObjects.Sprite;
  private readonly ledgerPrimary: Phaser.GameObjects.BitmapText;
  private readonly ledgerMirror: Phaser.GameObjects.BitmapText;
  private readonly ledgerMaskShape: Phaser.GameObjects.Rectangle;
  private readonly votePrompt: Phaser.GameObjects.Container;
  private readonly votePromptLabel: Phaser.GameObjects.BitmapText;
  private readonly voteZones: Record<VoteZoneId, Phaser.GameObjects.Rectangle>;
  private readonly altar: Phaser.GameObjects.Image;
  private ledgerText = "";
  private voting = false;

  constructor(private readonly scene: BaseWorldScene) {
    this.hearth = this.scene.add
      .sprite(416, 246, "fx-hearth-fire-0")
      .setDepth(260)
      .play("fx:hearth-fire");
    this.hearth.postFX?.addGlow(0xffad59, 2.2, 0.15, false, 0.1, 8);

    this.altar = this.scene.add.image(288, 270, "prop-skill-altar");
    this.altar.setDepth(274);
    this.altar.postFX?.addGlow(0x64e9ff, 1.8, 0.15, false, 0.12, 10);

    this.ledgerMaskShape = this.scene.add
      .rectangle(416, 124, 268, 28, 0xffffff, 0)
      .setDepth(3000)
      .setVisible(false);
    const ledgerMask = this.ledgerMaskShape.createGeometryMask();

    this.ledgerPrimary = this.scene.add.bitmapText(294, 114, "ledger-font", "", 14);
    this.ledgerPrimary.setDepth(3100);
    this.ledgerPrimary.setTint(0x9ff4ff);
    this.ledgerPrimary.setMask(ledgerMask);

    this.ledgerMirror = this.scene.add.bitmapText(294, 114, "ledger-font", "", 14);
    this.ledgerMirror.setDepth(3100);
    this.ledgerMirror.setTint(0x9ff4ff);
    this.ledgerMirror.setMask(ledgerMask);

    this.voteZones = {
      aye: this.createVoteZone(306, 386, 0x5ef0c6, "AYE"),
      nay: this.createVoteZone(526, 386, 0xff8a74, "NAY"),
    };

    const promptBackground = this.scene.add
      .rectangle(0, 0, 216, 42, 0x081019, 0.88)
      .setStrokeStyle(2, 0x7de6ff, 0.4);
    this.votePromptLabel = this.scene.add.bitmapText(-90, -8, "ledger-font", "", 14);
    this.votePromptLabel.setTint(0xe9fbff);
    const promptHotkey = this.scene.add.bitmapText(-90, 8, "ledger-font", "CAST VOTE", 12);
    promptHotkey.setTint(0x7de6ff);

    this.votePrompt = this.scene.add.container(480, 486, [
      promptBackground,
      this.votePromptLabel,
      promptHotkey,
    ]);
    this.votePrompt.setScrollFactor(0);
    this.votePrompt.setDepth(3600);
    this.votePrompt.setVisible(false);
    this.votePrompt.setSize(216, 42);
    this.votePrompt.setInteractive(
      new Phaser.Geom.Rectangle(-108, -21, 216, 42),
      Phaser.Geom.Rectangle.Contains,
    );
    this.votePrompt.on("pointerdown", () => {
      const activeZone = this.resolveActiveZone();
      if (!activeZone) {
        return;
      }

      void this.castVote(activeZone === "aye");
    });
  }

  apply(world: WorldReactionState) {
    const activeProposalCount = world.activeProposalCount;
    const fireScale = 0.94 + activeProposalCount * 0.22;
    this.hearth.setScale(fireScale);
    this.hearth.setTint(activeProposalCount > 0 ? 0xffcf8a : 0xff8b52);

    const latestTx = bazaarGameStore.getState().liveStatus?.gateway.latestTxHash ?? world.latestTxHash;
    const nextLedgerText = `BLOCK ${world.blockHeight.toString().padStart(8, "0")}   TX ${shortHash(latestTx)}   X LAYER GATEWAY   `;
    if (nextLedgerText !== this.ledgerText) {
      this.ledgerText = nextLedgerText;
      this.ledgerPrimary.setText(nextLedgerText);
      this.ledgerMirror.setText(nextLedgerText);
      this.ledgerPrimary.x = 294;
      this.ledgerMirror.x = this.ledgerPrimary.x + this.ledgerPrimary.width + 42;
    }
  }

  update(_time: number, delta: number) {
    const scrollAmount = (28 + bazaarGameStore.getState().world.activeProposalCount * 10) * (delta / 1000);
    this.ledgerPrimary.x -= scrollAmount;
    this.ledgerMirror.x -= scrollAmount;

    if (this.ledgerPrimary.x + this.ledgerPrimary.width < 282) {
      this.ledgerPrimary.x = this.ledgerMirror.x + this.ledgerMirror.width + 42;
    }
    if (this.ledgerMirror.x + this.ledgerMirror.width < 282) {
      this.ledgerMirror.x = this.ledgerPrimary.x + this.ledgerPrimary.width + 42;
    }

    const activeZone = this.resolveActiveZone();
    this.votePrompt.setVisible(Boolean(activeZone) && !this.voting);
    this.votePromptLabel.setText(activeZone ? `COUNCIL ${activeZone.toUpperCase()}` : "");
  }

  private createVoteZone(x: number, y: number, color: number, label: string) {
    const zone = this.scene.add.rectangle(x, y, 112, 54, color, 0.12);
    zone.setStrokeStyle(2, color, 0.42);
    zone.setDepth(248);

    const text = this.scene.add.bitmapText(x - 32, y - 8, "ledger-font", label, 16);
    text.setDepth(249);
    text.setTint(color);

    return zone;
  }

  private resolveActiveZone(): VoteZoneId | null {
    const player = this.scene.getPlayerCharacter().getPosition();

    if (Phaser.Geom.Rectangle.Contains(this.voteZones.aye.getBounds(), player.x, player.y)) {
      return "aye";
    }

    if (Phaser.Geom.Rectangle.Contains(this.voteZones.nay.getBounds(), player.x, player.y)) {
      return "nay";
    }

    return null;
  }

  private async castVote(support: boolean) {
    if (this.voting) {
      return;
    }

    this.voting = true;
    const actionId = "vote-rule-change";
    bazaarAudioSystem.play("ui-confirm");
    bazaarGameStore.getState().setPendingAction({
      actionId,
      label: support ? "Council aye" : "Council nay",
      status: "pending",
      startedAt: Date.now(),
    });

    try {
      const payload = await transactionService.vote(support);
      if ("status" in payload) {
        const worldState = deriveWorldState(payload.status);
        bazaarGameStore.getState().setLiveStatus(payload.status);
        bazaarGameStore.getState().setWorldState(worldState);
        bazaarGameStore.getState().pushProofs(buildProofArtifacts(payload.status));
        bazaarEventBridge.emit("economy:sync", { status: payload.status, world: worldState });
        bazaarEventBridge.emit("tx:confirmed", {
          actionId,
          stepKey: payload.stepKey ?? "vote-worker",
          txHash: payload.txHash,
        });
        bazaarEventBridge.emit("toast:show", {
          id: `vote:${payload.txHash ?? Date.now()}`,
          title: support ? "Council Aye Cast" : "Council Nay Logged",
          body: support
            ? "The covenant vote has been routed into the live governance loop."
            : "A nay stance was recorded locally for this council floor pass.",
          tone: "proof",
        });
      } else {
        bazaarEventBridge.emit("toast:show", {
          id: `vote:simulated:${Date.now()}`,
          title: "Council Nay Logged",
          body: "Negative votes are simulated locally in this council demo pass.",
          tone: "proof",
        });
      }
    } catch (error) {
      bazaarGameStore.getState().setPendingAction({
        actionId,
        label: "Council vote",
        status: "failed",
        startedAt: Date.now(),
        errorMessage: error instanceof Error ? error.message : "Vote failed.",
      });
      bazaarEventBridge.emit("toast:show", {
        id: `vote:error:${Date.now()}`,
        title: "Vote Failed",
        body: error instanceof Error ? error.message : "Unable to route the council vote.",
        tone: "proof",
      });
    } finally {
      this.voting = false;
    }
  }
}
