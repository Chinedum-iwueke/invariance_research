import assert from "node:assert/strict";
import test from "node:test";
import type { ReactElement, ReactNode } from "react";
import { BenchmarkSelector, type BenchmarkSelectionValue } from "@/components/analysis/BenchmarkSelector";

function isElement(node: ReactNode): node is ReactElement {
  return Boolean(node) && typeof node === "object" && "props" in (node as object);
}

function findElementByType(node: ReactNode, type: string): ReactElement | undefined {
  if (!isElement(node)) return undefined;
  if (node.type === type) return node;

  const children = node.props?.children;
  if (!children) return undefined;

  if (Array.isArray(children)) {
    for (const child of children) {
      const found = findElementByType(child, type);
      if (found) return found;
    }
    return undefined;
  }

  return findElementByType(children, type);
}

function getSelectProps(value: BenchmarkSelectionValue, onChange: (value: BenchmarkSelectionValue) => void) {
  const tree = BenchmarkSelector({ value, onChange });
  const select = findElementByType(tree, "select");
  assert.ok(select, "Expected select element");
  return select.props as { value: string; onChange: (event: { target: { value: string } }) => void };
}

test("BenchmarkSelector defaults to Auto mode value", () => {
  const props = getSelectProps({ mode: "auto", requested_id: null }, () => undefined);
  assert.equal(props.value, "auto");
});

test("BenchmarkSelector emits none with explicit null requested_id", () => {
  const events: BenchmarkSelectionValue[] = [];
  const props = getSelectProps({ mode: "auto", requested_id: null }, (next) => events.push(next));

  props.onChange({ target: { value: "none" } });

  assert.deepEqual(events, [{ mode: "none", requested_id: null }]);
});

test("BenchmarkSelector switches into manual mode and emits requested benchmark id", () => {
  const events: BenchmarkSelectionValue[] = [];
  const props = getSelectProps({ mode: "auto", requested_id: null }, (next) => events.push(next));

  props.onChange({ target: { value: "SPY" } });

  assert.deepEqual(events, [{ mode: "manual", requested_id: "SPY" }]);
});

test("BenchmarkSelector preserves manual value when rendering", () => {
  const props = getSelectProps({ mode: "manual", requested_id: "XAUUSD" }, () => undefined);
  assert.equal(props.value, "XAUUSD");
});

test("BenchmarkSelector falls back to BTC when manual is selected without requested_id", () => {
  const props = getSelectProps({ mode: "manual", requested_id: null }, () => undefined);
  assert.equal(props.value, "BTC");
});
