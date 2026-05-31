"""Framework adapters for nodetracer.

Each adapter is an optional, lazy-imported module that bridges a specific
agent framework's lifecycle events to nodetracer spans. Adapters are not
required for the core library and pull in framework dependencies via
optional extras (e.g. ``pip install nodetracer[langchain]``).
"""
