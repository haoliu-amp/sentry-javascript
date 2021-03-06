import { BrowserClient } from '@sentry/browser';
import { Hub, Scope } from '@sentry/hub';
import { SpanStatus } from '@sentry/types';

import { Span, TRACEPARENT_REGEXP } from '../src';

describe('Span', () => {
  let hub: Hub;

  beforeEach(() => {
    const myScope = new Scope();
    hub = new Hub(new BrowserClient({ tracesSampleRate: 1 }), myScope);
  });

  describe('newSpan', () => {
    test('simple', () => {
      const span = new Span({ sampled: true });
      const span2 = span.child();
      expect((span2 as any)._parentSpanId).toBe((span as any)._spanId);
      expect((span2 as any)._traceId).toBe((span as any)._traceId);
      expect((span2 as any).sampled).toBe((span as any).sampled);
    });

    test('gets currentHub', () => {
      const span = new Span({});
      const span2 = span.child();
      expect((span as any)._hub).toBeInstanceOf(Hub);
      expect((span2 as any)._hub).toBeInstanceOf(Hub);
    });
  });

  describe('setters', () => {
    test('setTag', () => {
      const span = new Span({});
      expect(span.tags.foo).toBeUndefined();
      span.setTag('foo', 'bar');
      expect(span.tags.foo).toBe('bar');
      span.setTag('foo', 'baz');
      expect(span.tags.foo).toBe('baz');
    });

    test('setData', () => {
      const span = new Span({});
      expect(span.data.foo).toBeUndefined();
      span.setData('foo', null);
      expect(span.data.foo).toBe(null);
      span.setData('foo', 2);
      expect(span.data.foo).toBe(2);
      span.setData('foo', true);
      expect(span.data.foo).toBe(true);
    });
  });

  describe('status', () => {
    test('setStatus', () => {
      const span = new Span({});
      span.setStatus(SpanStatus.PermissionDenied);
      expect((span.getTraceContext() as any).status).toBe('permission_denied');
    });

    test('setHttpStatus', () => {
      const span = new Span({});
      span.setHttpStatus(404);
      expect((span.getTraceContext() as any).status).toBe('not_found');
      expect(span.tags['http.status_code']).toBe('404');
    });

    test('isSuccess', () => {
      const span = new Span({});
      expect(span.isSuccess()).toBe(false);
      span.setHttpStatus(200);
      expect(span.isSuccess()).toBe(true);
      span.setStatus(SpanStatus.PermissionDenied);
      expect(span.isSuccess()).toBe(false);
    });
  });

  describe('newSpan', () => {
    test('simple', () => {
      const span = new Span({ sampled: true });
      const span2 = span.child();
      expect((span2 as any)._parentSpanId).toBe((span as any)._spanId);
      expect((span2 as any)._traceId).toBe((span as any)._traceId);
      expect((span2 as any).sampled).toBe((span as any).sampled);
    });

    test('gets currentHub', () => {
      const span = new Span({});
      const span2 = span.child();
      expect((span as any)._hub).toBeInstanceOf(Hub);
      expect((span2 as any)._hub).toBeInstanceOf(Hub);
    });

    test('inherit span list', () => {
      const span = new Span({ sampled: true });
      const span2 = span.child();
      const span3 = span.child();
      span3.finish();
      expect(span.spanRecorder).toBe(span2.spanRecorder);
      expect(span.spanRecorder).toBe(span3.spanRecorder);
    });
  });

  describe('toTraceparent', () => {
    test('simple', () => {
      expect(new Span().toTraceparent()).toMatch(TRACEPARENT_REGEXP);
    });
    test('with sample', () => {
      expect(new Span({ sampled: true }).toTraceparent()).toMatch(TRACEPARENT_REGEXP);
    });
  });

  describe('fromTraceparent', () => {
    test('no sample', () => {
      const from = Span.fromTraceparent('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb') as any;

      expect(from._parentSpanId).toEqual('bbbbbbbbbbbbbbbb');
      expect(from._traceId).toEqual('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
      expect(from._spanId).not.toEqual('bbbbbbbbbbbbbbbb');
      expect(from.sampled).toBeUndefined();
    });
    test('sample true', () => {
      const from = Span.fromTraceparent('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-1') as any;
      expect(from.sampled).toBeTruthy();
    });

    test('sample false', () => {
      const from = Span.fromTraceparent('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-0') as any;
      expect(from.sampled).toBeFalsy();
    });

    test('just sample rate', () => {
      const from = Span.fromTraceparent('0') as any;
      expect(from._traceId).toHaveLength(32);
      expect(from._spanId).toHaveLength(16);
      expect(from.sampled).toBeFalsy();

      const from2 = Span.fromTraceparent('1') as any;
      expect(from2._traceId).toHaveLength(32);
      expect(from2._spanId).toHaveLength(16);
      expect(from2.sampled).toBeTruthy();
    });

    test('invalid', () => {
      expect(Span.fromTraceparent('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-x')).toBeUndefined();
    });
  });

  describe('toJSON', () => {
    test('simple', () => {
      const span = JSON.parse(
        JSON.stringify(new Span({ traceId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', spanId: 'bbbbbbbbbbbbbbbb' })),
      );
      expect(span).toHaveProperty('span_id', 'bbbbbbbbbbbbbbbb');
      expect(span).toHaveProperty('trace_id', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    });

    test('with parent', () => {
      const spanA = new Span({ traceId: 'a', spanId: 'b' }) as any;
      const spanB = new Span({ traceId: 'c', spanId: 'd', sampled: false, parentSpanId: spanA._spanId });
      const serialized = JSON.parse(JSON.stringify(spanB));
      expect(serialized).toHaveProperty('parent_span_id', 'b');
      expect(serialized).toHaveProperty('span_id', 'd');
      expect(serialized).toHaveProperty('trace_id', 'c');
    });

    test('should drop all `undefined` values', () => {
      const spanA = new Span({ traceId: 'a', spanId: 'b' }) as any;
      const spanB = new Span({
        parentSpanId: spanA._spanId,
        sampled: false,
        spanId: 'd',
        traceId: 'c',
      });
      const serialized = spanB.toJSON();
      expect(serialized).toHaveProperty('start_timestamp');
      delete (serialized as { start_timestamp: number }).start_timestamp;
      expect(serialized).toStrictEqual({
        parent_span_id: 'b',
        sampled: false,
        span_id: 'd',
        trace_id: 'c',
      });
    });
  });

  describe('finish', () => {
    test('simple', () => {
      const span = new Span({});
      expect(span.timestamp).toBeUndefined();
      span.finish();
      expect(span.timestamp).toBeGreaterThan(1);
    });

    describe('hub.startSpan', () => {
      test('finish a span', () => {
        const spy = jest.spyOn(hub as any, 'captureEvent') as any;
        const span = hub.startSpan();
        span.finish();
        expect(spy).toHaveBeenCalled();
        expect(spy.mock.calls[0][0].spans).toHaveLength(0);
        expect(spy.mock.calls[0][0].timestamp).toBeTruthy();
        expect(spy.mock.calls[0][0].start_timestamp).toBeTruthy();
        expect(spy.mock.calls[0][0].contexts.trace).toEqual(span.getTraceContext());
      });

      test('finish a span with transaction + child span', () => {
        const spy = jest.spyOn(hub as any, 'captureEvent') as any;
        const parentSpan = hub.startSpan();
        const childSpan = parentSpan.child();
        childSpan.finish();
        parentSpan.finish();
        expect(spy).toHaveBeenCalled();
        expect(spy.mock.calls[0][0].spans).toHaveLength(1);
        expect(spy.mock.calls[0][0].contexts.trace).toEqual(parentSpan.getTraceContext());
      });

      test("finish a child span shouldn't trigger captureEvent", () => {
        const spy = jest.spyOn(hub as any, 'captureEvent') as any;
        const parentSpan = hub.startSpan();
        const childSpan = parentSpan.child();
        childSpan.finish();
        expect(spy).not.toHaveBeenCalled();
      });

      test('finish a span with another one on the scope should add the span and not call captureEvent', () => {
        const spy = jest.spyOn(hub as any, 'captureEvent') as any;

        const spanOne = hub.startSpan();
        const childSpanOne = spanOne.child();
        childSpanOne.finish();

        hub.configureScope(scope => {
          scope.setSpan(spanOne);
        });

        const spanTwo = hub.startSpan();
        spanTwo.finish();

        expect(spy).not.toHaveBeenCalled();
        expect((spanOne as any).spanRecorder.spans).toHaveLength(3);
        // We only want two finished spans
        expect((spanOne as any).spanRecorder.spans.filter((s: Span) => !!s.timestamp)).toHaveLength(2);
      });

      test("finish a span with another one on the scope shouldn't override contexts.trace", () => {
        const spy = jest.spyOn(hub as any, 'captureEvent') as any;

        const spanOne = hub.startSpan();
        const childSpanOne = spanOne.child();
        childSpanOne.finish();

        hub.configureScope(scope => {
          scope.setSpan(spanOne);
        });

        const spanTwo = hub.startSpan();
        spanTwo.finish();
        spanOne.finish();

        expect(spy).toHaveBeenCalled();
        expect(spy.mock.calls[0][0].spans).toHaveLength(2);
        expect(spy.mock.calls[0][0].contexts.trace).toEqual(spanOne.getTraceContext());
      });

      test('span child limit', () => {
        const _hub = new Hub(
          new BrowserClient({
            _experiments: { maxSpans: 3 },
            tracesSampleRate: 1,
          }),
        );
        const spy = jest.spyOn(_hub as any, 'captureEvent') as any;
        const span = _hub.startSpan();
        for (let i = 0; i < 10; i++) {
          const child = span.child();
          child.finish();
        }
        span.finish();
        expect(spy.mock.calls[0][0].spans).toHaveLength(3);
      });

      test('if we sampled the parent (transaction) we do not want any childs', () => {
        const _hub = new Hub(
          new BrowserClient({
            tracesSampleRate: 0,
          }),
        );
        const spy = jest.spyOn(_hub as any, 'captureEvent') as any;
        const span = _hub.startSpan();
        for (let i = 0; i < 10; i++) {
          const child = span.child();
          child.finish();
        }
        span.finish();
        expect((span as any).spanRecorder).toBeUndefined();
        expect(spy).not.toHaveBeenCalled();
      });

      test('mixing hub.startSpan + span.child + maxSpans', () => {
        const _hub = new Hub(
          new BrowserClient({
            _experiments: { maxSpans: 2 },
            tracesSampleRate: 1,
          }),
        );
        const spy = jest.spyOn(_hub as any, 'captureEvent') as any;

        const spanOne = _hub.startSpan();
        const childSpanOne = spanOne.child({ op: '1' });
        childSpanOne.finish();

        _hub.configureScope(scope => {
          scope.setSpan(spanOne);
        });

        const spanTwo = _hub.startSpan({ op: '2' });
        spanTwo.finish();

        const spanThree = _hub.startSpan({ op: '3' });
        spanThree.finish();

        spanOne.finish();

        expect(spy).toHaveBeenCalled();
        expect(spy.mock.calls[0][0].spans).toHaveLength(2);
      });

      test('tree structure of spans should be correct when mixing it with span on scope', () => {
        const spy = jest.spyOn(hub as any, 'captureEvent') as any;

        const spanOne = hub.startSpan();
        const childSpanOne = spanOne.child();

        const childSpanTwo = childSpanOne.child();
        childSpanTwo.finish();

        childSpanOne.finish();

        hub.configureScope(scope => {
          scope.setSpan(spanOne);
        });

        const spanTwo = hub.startSpan();
        spanTwo.finish();
        spanOne.finish();

        expect(spy).toHaveBeenCalled();
        expect(spy.mock.calls[0][0].spans).toHaveLength(3);
        expect(spy.mock.calls[0][0].contexts.trace).toEqual(spanOne.getTraceContext());
        expect(childSpanOne.toJSON().parent_span_id).toEqual(spanOne.toJSON().span_id);
        expect(childSpanTwo.toJSON().parent_span_id).toEqual(childSpanOne.toJSON().span_id);
        expect(spanTwo.toJSON().parent_span_id).toEqual(spanOne.toJSON().span_id);
      });
    });
  });

  describe('getTraceContext', () => {
    test('should have status attribute undefined if no status tag is available', () => {
      const span = new Span({});
      const context = span.getTraceContext();
      expect((context as any).status).toBeUndefined();
    });

    test('should have success status extracted from tags', () => {
      const span = new Span({});
      span.setStatus(SpanStatus.Ok);
      const context = span.getTraceContext();
      expect((context as any).status).toBe('ok');
    });

    test('should have failure status extracted from tags', () => {
      const span = new Span({});
      span.setStatus(SpanStatus.ResourceExhausted);
      const context = span.getTraceContext();
      expect((context as any).status).toBe('resource_exhausted');
    });

    test('should drop all `undefined` values', () => {
      const spanB = new Span({ spanId: 'd', traceId: 'c' });
      const context = spanB.getTraceContext();
      expect(context).toStrictEqual({
        span_id: 'd',
        trace_id: 'c',
      });
    });
  });
});
