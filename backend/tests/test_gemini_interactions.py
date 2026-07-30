"""Unit tests for the Interactions-API response readers — network/SDK-free.

These pin the ``google-genai >= 2.0`` ``steps`` schema our helpers read: an
``Interaction`` has a convenience ``output_text`` plus a list of ``steps``, where
``model_output`` steps carry ``text`` content and grounding citations ride as
``url_citation`` annotations on that text. We model steps/blocks/annotations as
plain attribute bags (a ``type`` discriminator plus the fields we read) so the
tests stay fast and dependency-free.
"""

from types import SimpleNamespace

import pytest

from gemini_interactions import citation_urls, create_with_retry, output_text


def _block(text, annotations=None):
    return SimpleNamespace(type="text", text=text, annotations=annotations)


def _model_output(*blocks):
    return SimpleNamespace(type="model_output", content=list(blocks))


def _url_citation(url):
    return SimpleNamespace(type="url_citation", url=url, title="t")


def _interaction(*steps, output_text=None):
    return SimpleNamespace(steps=list(steps), output_text=output_text)


# --- output_text -------------------------------------------------------------

def test_output_text_prefers_convenience_property():
    inter = _interaction(_model_output(_block("ignored")), output_text='{"a": 1}')
    assert output_text(inter) == '{"a": 1}'


def test_output_text_falls_back_to_model_output_blocks():
    inter = _interaction(
        SimpleNamespace(type="thought", content=[_block("…thinking…")]),
        _model_output(_block('{"a":'), _block(" 1}")),
        output_text=None,
    )
    # Thought steps are skipped; model_output text concatenates in order.
    assert output_text(inter) == '{"a": 1}'


def test_output_text_empty_when_nothing():
    assert output_text(SimpleNamespace(steps=None, output_text=None)) == ""


# --- citation_urls -----------------------------------------------------------

def test_citation_urls_from_url_citation_annotations():
    inter = _interaction(
        _model_output(
            _block("a sentence", annotations=[_url_citation("https://a.com/1")]),
            _block("another", annotations=[_url_citation("https://b.com/2")]),
        ),
    )
    assert citation_urls(inter) == ["https://a.com/1", "https://b.com/2"]


def test_citation_urls_ignores_non_url_citation_annotations():
    block = _block(
        "x",
        annotations=[
            SimpleNamespace(type="file_citation", url=None),
            _url_citation("https://c.com/3"),
        ],
    )
    assert citation_urls(_interaction(_model_output(block))) == ["https://c.com/3"]


def test_citation_urls_empty_on_no_steps():
    assert citation_urls(SimpleNamespace(steps=None, output_text=None)) == []


# --- create_with_retry ---------------------------------------------------------

class _FakeClient:
    """interactions.create stub that fails ``failures`` times, then succeeds."""

    def __init__(self, failures=0):
        self.calls = []
        self._failures = failures
        self.interactions = SimpleNamespace(create=self._create)

    def _create(self, **kwargs):
        self.calls.append(kwargs)
        if len(self.calls) <= self._failures:
            raise ConnectionError("Server disconnected without sending a response.")
        return SimpleNamespace(output_text="ok")


def test_create_with_retry_first_try_success_no_sleep():
    client = _FakeClient(failures=0)
    slept = []
    result = create_with_retry(client, sleep=slept.append, model="m", input="p")
    assert result.output_text == "ok"
    assert client.calls == [{"model": "m", "input": "p"}]
    assert slept == []


def test_create_with_retry_recovers_from_transient_failures_with_backoff():
    client = _FakeClient(failures=2)
    slept = []
    result = create_with_retry(client, sleep=slept.append, model="m", input="p")
    assert result.output_text == "ok"
    assert len(client.calls) == 3
    assert len(slept) == 2 and slept[1] > slept[0] > 0  # growing backoff


def test_create_with_retry_raises_after_exhausting_attempts():
    client = _FakeClient(failures=99)
    slept = []
    with pytest.raises(ConnectionError):
        create_with_retry(client, attempts=3, sleep=slept.append, model="m", input="p")
    assert len(client.calls) == 3
    assert len(slept) == 2  # no sleep after the final failure
