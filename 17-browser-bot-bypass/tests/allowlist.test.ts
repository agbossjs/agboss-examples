/**
 * The allowlist as a rule (agbossjs/agboss#1261): an attempt to open 127.0.0.1, `localhost`, the
 * cloud metadata address, a LAN address, a non-web scheme or another port of a listed host is
 * refused; a listed origin is not. A sabotage — `isAllowedUrl` returning true, or the resolver
 * rule dropped — turns these red (the PR's sabotage table).
 */
import { describe, expect, it } from "vitest";
import { isAllowedUrl, parseAllowlist, resolverRulesOf } from "../src/browser/origin-allowlist.js";

const ALLOWED = parseAllowlist("https://docs.example.com; http://shop.test:8080").origins;

describe("isAllowedUrl", () => {
  it.each([
    "https://docs.example.com/pricing",
    "https://docs.example.com/a/b?c=d#e",
    "http://shop.test:8080/contact",
  ])("allows %s", (url) => {
    expect(isAllowedUrl(url, ALLOWED)).toBe(true);
  });

  it.each([
    ["the loopback", "http://127.0.0.1/"],
    ["the loopback on a port", "http://127.0.0.1:8080/secret"],
    ["localhost", "http://localhost:8080/"],
    ["the IPv6 loopback", "http://[::1]/"],
    ["the cloud metadata address", "http://169.254.169.254/latest/meta-data/"],
    ["a LAN address", "http://192.168.1.1/admin"],
    ["a private 10.x address", "http://10.0.0.5/"],
    ["an address written as a decimal number", "http://2130706433/"],
    ["a file", "file:///etc/passwd"],
    ["a data URL", "data:text/html,<h1>x</h1>"],
    ["javascript", "javascript:alert(1)"],
    ["another host", "https://evil.example.net/"],
    ["a listed host on another port", "http://shop.test:9999/"],
    ["a listed host on another scheme", "http://docs.example.com/"],
    ["a look-alike host", "https://docs.example.com.evil.net/"],
    ["credentials in front of a look-alike", "https://docs.example.com@evil.net/"],
    ["not a URL", "docs.example.com/pricing"],
  ])("refuses %s", (_what, url) => {
    expect(isAllowedUrl(url, ALLOWED)).toBe(false);
  });

  it("allows nothing when nothing is listed", () => {
    expect(isAllowedUrl("https://docs.example.com/", [])).toBe(false);
  });
});

describe("parseAllowlist", () => {
  it("lists origins; an entry may map a name with no DNS to an address (tests and demos only)", () => {
    expect(parseAllowlist("https://docs.example.com/ ; http://shop.test:8080=127.0.0.1")).toEqual({
      origins: ["https://docs.example.com", "http://shop.test:8080"],
      hostMap: "MAP shop.test 127.0.0.1",
    });
  });

  it("a deployment's list has no map", () => {
    expect(parseAllowlist("https://docs.example.com").hostMap).toBe("");
    expect(parseAllowlist(undefined)).toEqual({ origins: [], hostMap: "" });
  });
});

describe("resolverRulesOf: the browser's resolver", () => {
  it("resolves only the listed hostnames; every other name and every IP literal fails", () => {
    expect(resolverRulesOf(ALLOWED)).toBe("EXCLUDE docs.example.com, EXCLUDE shop.test, MAP * ~NOTFOUND");
  });

  it("a test site's mapped name is mapped, not excluded (Chromium checks EXCLUDE first and then maps nothing)", () => {
    expect(resolverRulesOf(ALLOWED, "MAP shop.test 127.0.0.1")).toBe(
      "MAP shop.test 127.0.0.1, EXCLUDE docs.example.com, MAP * ~NOTFOUND",
    );
  });

  it("ends with the rule that fails everything else", () => {
    expect(resolverRulesOf([]).endsWith("MAP * ~NOTFOUND")).toBe(true);
  });
});
