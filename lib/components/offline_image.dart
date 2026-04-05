import 'dart:io';
import 'package:flutter/material.dart';
import 'package:navidrome_client/services/offline_service.dart';

/// #6: StatefulWidget resolves the local path once in initState,
/// so there is no FutureBuilder rebuilding on every frame.
class OfflineImage extends StatefulWidget {
  final String? coverArtId;
  final String? remoteUrl;
  final double? width;
  final double? height;
  final BoxFit fit;
  final Widget placeholder;

  const OfflineImage({
    super.key,
    this.coverArtId,
    this.remoteUrl,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    required this.placeholder,
  });

  @override
  State<OfflineImage> createState() => _OfflineImageState();
}

class _OfflineImageState extends State<OfflineImage> {
  String? _localPath;
  bool _resolved = false;

  @override
  void initState() {
    super.initState();
    OfflineService().addListener(_resolve);
    _resolve();
  }

  @override
  void didUpdateWidget(OfflineImage old) {
    super.didUpdateWidget(old);
    // re-resolve if the cover art ID changed
    if (old.coverArtId != widget.coverArtId) {
      setState(() { _resolved = false; _localPath = null; });
      _resolve();
    }
  }

  Future<void> _resolve() async {
    final path = await OfflineService().getLocalCoverArtPath(widget.coverArtId);
    if (mounted) {
      if (path != _localPath || !_resolved) {
        setState(() {
          _localPath = path;
          _resolved = true;
        });
      }
    }
  }

  @override
  void dispose() {
    OfflineService().removeListener(_resolve);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_resolved) {
      // while resolving, immediately try the remote image to avoid blank flash
      return _buildImage(localPath: null);
    }
    return _buildImage(localPath: _localPath);
  }

  Widget _buildImage({required String? localPath}) {
    Widget? image;

    if (localPath != null) {
      image = Image.file(
        File(localPath),
        width: widget.width,
        height: widget.height,
        fit: widget.fit,
        gaplessPlayback: true,
        errorBuilder: (context, error, stackTrace) => _buildRemote(),
      );
    } else {
      image = _buildRemote();
    }

    return SizedBox(
      width: widget.width,
      height: widget.height,
      child: image,
    );
  }

  Widget _buildRemote() {
    if (widget.remoteUrl == null) return widget.placeholder;
    return Image.network(
      widget.remoteUrl!,
      width: widget.width,
      height: widget.height,
      fit: widget.fit,
      gaplessPlayback: true,
      errorBuilder: (context, error, stackTrace) => widget.placeholder,
    );
  }
}
