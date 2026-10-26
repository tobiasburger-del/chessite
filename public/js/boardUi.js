// Shared board setup for the review, Train and Play pages: one look, legal-move
// hints, click- or drag-to-move, promotion choice, last-move and check
// highlights. Needs /js/boardRules.js loaded first (globalThis.BoardRules).
import { Chess } from "/vendor/chess.js/chess.js";
import {
  Chessboard,
  COLOR,
  BORDER_TYPE,
  INPUT_EVENT_TYPE,
} from "/vendor/cm-chessboard/src/Chessboard.js";
import { Arrows } from "/vendor/cm-chessboard/src/extensions/arrows/Arrows.js";
import {
  Markers,
  MARKER_TYPE,
} from "/vendor/cm-chessboard/src/extensions/markers/Markers.js";
import {
  PromotionDialog,
  PROMOTION_DIALOG_RESULT_TYPE,
} from "/vendor/cm-chessboard/src/extensions/promotion-dialog/PromotionDialog.js";

const { legalTargets, isPromotion, checkedKingSquare } = globalThis.BoardRules;

const MARKER = {
  selected: { class: "marker-selected", slice: "markerSquare" },
  lastMove: { class: "marker-last-move", slice: "markerSquare" },
  check: { class: "marker-check", slice: "markerCircleFilled" },
};

export function createBoard(el, { position, orientation = "w" }) {
  return new Chessboard(el, {
    position,
    orientation: orientation === "b" ? COLOR.black : COLOR.white,
    assetsUrl: "/vendor/cm-chessboard/assets/",
    extensions: [
      { class: Markers, props: { autoMarkers: MARKER.selected } },
      { class: Arrows, props: { headSize: 8, offsetTo: 0.25 } },
      { class: PromotionDialog, props: { language: "en" } },
    ],
    style: {
      cssClass: "bulletin",
      showCoordinates: true,
      borderType: BORDER_TYPE.thin,
      pieces: { file: "pieces/standard.svg", tileSize: 40 },
      animationDuration: 220,
    },
  });
}

// Lets you move `color`'s pieces in the position `fen()`. `onMove` gets the
// chess.js move (with the promotion piece you picked). Cancelling the
// promotion dialog puts the pawn back and keeps it your move.
export function enablePlayerInput(board, { fen, color, onMove }) {
  const boardColor = color === "b" ? COLOR.black : COLOR.white;

  function play(from, to, promotion) {
    const move = new Chess(fen()).move({ from, to, promotion });
    onMove(move);
  }

  board.enableMoveInput((event) => {
    switch (event.type) {
      case INPUT_EVENT_TYPE.moveInputStarted: {
        board.removeLegalMovesMarkers();
        if (!(event.piece || "").startsWith(color)) return false;
        const targets = legalTargets(new Chess(fen()), event.squareFrom);
        for (const t of targets) {
          board.addMarker(t.capture ? MARKER_TYPE.bevel : MARKER_TYPE.dot, t.to);
        }
        return targets.length > 0;
      }
      case INPUT_EVENT_TYPE.validateMoveInput:
        return legalTargets(new Chess(fen()), event.squareFrom).some(
          (t) => t.to === event.squareTo,
        );
      case INPUT_EVENT_TYPE.moveInputCanceled:
        board.removeLegalMovesMarkers();
        return true;
      case INPUT_EVENT_TYPE.moveInputFinished: {
        board.removeLegalMovesMarkers();
        if (!event.legalMove) return true;
        const { squareFrom: from, squareTo: to } = event;
        if (!isPromotion(new Chess(fen()), from, to)) {
          play(from, to);
          return true;
        }
        board.showPromotionDialog(to, boardColor, (result) => {
          if (result.type === PROMOTION_DIALOG_RESULT_TYPE.pieceSelected) {
            play(from, to, result.piece.charAt(1));
          } else {
            board.setPosition(fen(), true);
          }
        });
        return true;
      }
      default:
        return true;
    }
  }, boardColor);
}

export function showLastMove(board, from, to) {
  board.removeMarkers(MARKER.lastMove);
  board.addMarker(MARKER.lastMove, from);
  board.addMarker(MARKER.lastMove, to);
}

export function showCheck(board, fen) {
  board.removeMarkers(MARKER.check);
  const square = checkedKingSquare(new Chess(fen));
  if (square) board.addMarker(MARKER.check, square);
}

export function clearHighlights(board) {
  board.removeMarkers(MARKER.lastMove);
  board.removeMarkers(MARKER.check);
  board.removeLegalMovesMarkers();
}
