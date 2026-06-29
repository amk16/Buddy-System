"""Unit tests for the Interactions-API response readers — network/SDK-free.

These pin the ``google-genai >= 2.0`` ``steps`` schema our helpers read: an
``Interaction`` has a convenience ``output_text`` plus a list of ``steps``, where
``model_output`` steps carry ``text`` content and grounding citations ride as
``url_citation`` annotations on that text. We model steps/blocks/annotations as
plain attribute bags (a ``type`` discriminator plus the fields we read) so the
tests stay fast and dependency-free.
"""

from types import SimpleNamespace

from gemini_interactions import citation_urls, output_text


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
