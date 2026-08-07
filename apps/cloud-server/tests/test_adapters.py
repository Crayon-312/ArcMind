import pytest

from arcmind_cloud.adapters import DeterministicModelProvider


@pytest.mark.asyncio
async def test_deterministic_model_is_explicit_and_repeatable() -> None:
    provider = DeterministicModelProvider()

    first = await provider.generate("  你好， ArcMind  ")
    second = await provider.generate("你好， ArcMind")

    assert first == second
    assert first.startswith("[测试模型]")
