/*global describe, it, beforeEach*/

import _ from "lodash";
import chai from 'chai';
import sinon from 'sinon';
import source_map from 'source-map-support';
import {DalmatinerQuery} from "./query";

source_map.install({handleUncaughtExceptions: false});


describe('DalmatinerQuery', function() {
  var expect = chai.expect,
      query;

  beforeEach(function() {
    query = new DalmatinerQuery();
  });
  
  describe('#equals', function() {

    it('should build a condition with name-space', function() {
      var c = DalmatinerQuery.equals(['dl', 'source'], 'agent1'); 
      expect('' + c).to.be.equal("dl:'source' = 'agent1'");
    });

    it('should build a condition without name-space', function() {
      var c = DalmatinerQuery.equals(['', 'custom'], 'some-value');
      expect('' + c).to.be.equal("'custom' = 'some-value'");
    });

    it('should build a condition that can be and-ed', function() {
      var c = DalmatinerQuery.equals(['label', 'production'], '')
            .and(DalmatinerQuery.equals(['label', 'web'], ''));
      expect('' + c).to.be.equal("label:'production' = '' AND label:'web' = ''");
    });

    it('should build a condition that can be or-ed', function() {
      var c = DalmatinerQuery.equals(['label', 'production'], '')
            .or(DalmatinerQuery.equals(['label', 'web'], ''));
      expect('' + c).to.be.equal("label:'production' = '' OR label:'web' = ''");
    });
  });

  describe('#present', function() {

    it('should build a condition checking presence of a tag', function() {
      var c = DalmatinerQuery.present(['label', 'production']);
      expect('' + c).to.be.equal("label:'production'");
    });
  });

  describe('#select', function() {

    it('should be enough for simple query when combined with from statement', function() {
      query.from('myorg')
        .select(['base', 'cpu', 'system']);
      expect(query.toUserString()).to.be
        .equal("SELECT 'base'.'cpu'.'system' IN 'myorg'");
    });

    it('should create multi part query when called multiple times', function() {
      query.from('myorg')
        .select(['base', 'cpu', 'system'])
        .select(['base', 'cpu', 'user']);
      expect(query.toUserString()).to.be
        .equal("SELECT 'base'.'cpu'.'system' IN 'myorg', 'base'.'cpu'.'user' IN 'myorg'");
    });

    it('should create selector for most recent collection', function() {
      query.from('first-org')
        .select(['base', 'cpu', 'system'])
        .from('second-org')
        .select(['base', 'cpu', 'user']);
      expect(query.toUserString()).to.be
        .equal("SELECT 'base'.'cpu'.'system' IN 'first-org', 'base'.'cpu'.'user' IN 'second-org'");
    });

  });
  
  describe('#apply', function() {

    it('should apply function on active selection', function() {
      query.from('myorg')
        .select(['base', 'network', 'eth0', 'sent'])
        .apply('derivate');
      expect(query.toUserString()).to.be
        .equal("SELECT derivate('base'.'network'.'eth0'.'sent' IN 'myorg')");
    });

    it('should support function with extra argument', function() {
      query.from('myorg')
        .select(['base', 'cpu'])
        .apply('avg', ['30s']);
      expect(query.toUserString()).to.be
        .equal("SELECT avg('base'.'cpu' IN 'myorg', 30s)");
    });

    it('should expand variables in function arguments', function() {
      query.from('myorg')
        .select(['base', 'cpu'])
        .with('interval', '30s')
        .apply('avg', ['$interval']);
      expect(query.toUserString()).to.be
        .equal("SELECT avg('base'.'cpu' IN 'myorg', 30s)");
    });

    it('should fail when variable is not defined', function() {
      query.from('myorg')
        .select(['base', 'cpu'])
        .apply('avg', ['$interval']);
      expect(query.toUserString).to.throw(Error);
    });

    it('should allow for function chaining', function() {
      query.from('myorg')
        .select(['base', 'network', 'eth0', 'sent'])
        .apply('derivate')
        .apply('sum', ['30s']);
      expect(query.toUserString()).to.be
        .equal("SELECT sum(derivate('base'.'network'.'eth0'.'sent' IN 'myorg'), 30s)");
    });
    
    it('should be applied only to last selection', function() {
      query.from('myorg')
        .select(['base', 'cpu', 'user'])
        .select(['base', 'cpu', 'system'])
        .apply('max', [])
        .select(['base', 'cpu', 'idle'])
        .apply('min', []);
      expect(query.toUserString()).to.be.equal(
        "SELECT 'base'.'cpu'.'user' IN 'myorg', " +
          "max('base'.'cpu'.'system' IN 'myorg'), " +
          "min('base'.'cpu'.'idle' IN 'myorg')"
      );
    });

  });
});
