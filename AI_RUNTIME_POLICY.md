# AI Runtime Policy

This repo uses a local-first rule for AI features.

1. Prefer local NVIDIA runtimes first.
   Evaluate RTX-local paths before cloud APIs when they are practical, including Nemotron, Nemotron Nano, Jet-Nemotron, TensorRT-LLM, vLLM, SGLang, and G-Assist style integrations.

2. No anonymous paid AI endpoints.
   Any cloud-billed model access must be disabled by default and require an explicit server-side opt-in plus authenticated access.

3. Cost review is required.
   New AI features should document the cheapest viable local path, the hosted/self-run path, and the paid API path before shipping.

4. Public UX cannot depend on RTX hardware.
   Local AI can be an acceleration path, but the core product must still work for users without NVIDIA hardware unless the product is explicitly desktop-only.

5. Keep keys and data tight.
   API keys stay server-side, request sizes should be bounded, and sensitive user data should not be sent to third-party models without a clear reason and consent.
